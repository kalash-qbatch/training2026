import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { duplicateProductError, productNotFoundError } from "@/lib/errors/products";
import { mapProduct } from "@/lib/mappers";
import { resolveCategoryId } from "@/lib/services/categories";
import type { ColorFilter, Product, ProductSort, SizeFilter } from "@/types";

export type { ColorFilter, ProductSort, SizeFilter };

const productInclude = {
  specifications: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  category: { select: { id: true, name: true, slug: true } },
} as const;

function normalizeTitle(title: string): string {
  return title.trim();
}

async function findProductByTitle(
  title: string,
  excludeId?: string
): Promise<{ id: string; title: string } | null> {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;

  return prisma.product.findFirst({
    where: {
      title: { equals: normalized, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, title: true },
  });
}

async function assertTitleAvailable(title: string, excludeId?: string) {
  const existing = await findProductByTitle(title, excludeId);
  if (existing) {
    throw duplicateProductError(existing.title);
  }
}

export async function findProducts(opts?: {
  search?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  categorySlug?: string;
}) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 8;
  const q = opts?.search?.trim();
  const where: Prisma.ProductWhereInput = {
    AND: [
      { isActive: true },
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      opts?.categoryId ? { categoryId: opts.categoryId } : {},
      opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {},
    ],
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    opts?.sort === "price-asc"
      ? { price: "asc" }
      : opts?.sort === "price-desc"
        ? { price: "desc" }
        : { title: "asc" };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: productInclude,
    }),
  ]);

  // Compute live stock in memory if specifications exist, avoiding DB write locks on read path
  for (const row of rows) {
    if (row.specifications.length > 0) {
      row.stock = row.specifications.reduce((acc, s) => acc + s.qty, 0);
    }
  }

  return {
    products: rows.map(mapProduct),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findProductById(id: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!row || !row.isActive) return null;
  return mapProduct(row);
}

export async function findAdminProducts(opts: {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 8;
  const q = opts.search?.trim();

  const where: Prisma.ProductWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      opts.categoryId ? { categoryId: opts.categoryId } : {},
      opts.isActive != null ? { isActive: opts.isActive } : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: productInclude,
    }),
  ]);

  return {
    products: rows.map(mapProduct),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

type ProductVariantInput = { color: string; size: string; qty: number };
type ProductImageInput = { url: string; color?: string };

function variantCreates(variants: ProductVariantInput[]) {
  return variants.map((v) => ({
    color: v.color.trim(),
    size: v.size.trim(),
    qty: v.qty,
  }));
}

function imageCreates(images: ProductImageInput[]) {
  return images.map((img, i) => ({
    url: img.url,
    color: img.color?.trim() ?? "",
    sortOrder: i,
  }));
}

function primaryImage(images?: ProductImageInput[], fallback?: string) {
  if (images?.length) {
    return images.find((img) => !img.color?.trim())?.url ?? images[0].url;
  }
  return fallback || "/products/tee.jpg";
}

async function syncSpecifications(productId: string, variants?: ProductVariantInput[]) {
  // Fetch all current specs for this product
  const existing = await prisma.specification.findMany({
    where: { productId },
  });

  if (!variants?.length) {
    // No variants → delete all specs (also clear cart items pointing to them)
    const existingIds = existing.map((s) => s.id);
    if (existingIds.length) {
      await prisma.cartItem.deleteMany({
        where: { specificationId: { in: existingIds } },
      });
      await prisma.specification.deleteMany({ where: { productId } });
    }
    return;
  }

  const incomingKeys = new Set(
    variants.map((v) => `${(v.color ?? "").toLowerCase()}::${(v.size ?? "").toLowerCase()}`)
  );

  // Step 1 – Delete specs (and their cart refs) that are no longer in the incoming list
  const toDelete = existing.filter(
    (s) => !incomingKeys.has(`${(s.color ?? "").toLowerCase()}::${(s.size ?? "").toLowerCase()}`)
  );
  if (toDelete.length) {
    const deleteIds = toDelete.map((s) => s.id);
    await prisma.cartItem.deleteMany({
      where: { specificationId: { in: deleteIds } },
    });
    await prisma.specification.deleteMany({
      where: { id: { in: deleteIds } },
    });
  }

  // Step 2 – Upsert each incoming variant (update qty if same color+size exists, create if new)
  for (const v of variants) {
    const colorKey = (v.color ?? "").toLowerCase();
    const sizeKey = (v.size ?? "").toLowerCase();
    const match = existing.find(
      (s) => (s.color ?? "").toLowerCase() === colorKey && (s.size ?? "").toLowerCase() === sizeKey
    );

    if (match) {
      // Update qty only — spec ID stays the same, cart items remain valid
      await prisma.specification.update({
        where: { id: match.id },
        data: { qty: v.qty },
      });
    } else {
      // Genuinely new variant — create it
      await prisma.specification.create({
        data: {
          productId,
          color: v.color ?? "",
          size: v.size ?? "",
          qty: v.qty,
        },
      });
    }
  }

  // Step 3 – Sync product.stock to sum of all spec qtys
  const agg = await prisma.specification.aggregate({
    where: { productId },
    _sum: { qty: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { stock: agg._sum.qty ?? 0 },
  });
}

async function syncImages(productId: string, images?: ProductImageInput[]) {
  if (images == null) return;
  await prisma.product.update({
    where: { id: productId },
    data: {
      images: {
        deleteMany: {},
        ...(images.length ? { create: imageCreates(images) } : {}),
      },
    },
  });
}

/** Keep Product.stock column aligned with Specification qtys (API source of truth). */
// async function reconcileProductStock(productId: string) {
//   const specs = await prisma.specification.findMany({
//     where: { productId },
//     select: { qty: true },
//   });
//   if (!specs.length) return;
//   const sum = specs.reduce((acc, s) => acc + s.qty, 0);
//   await prisma.product.update({
//     where: { id: productId },
//     data: { stock: sum },
//   });
// }

export async function createProduct(data: {
  title: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  images?: ProductImageInput[];
  color?: string;
  size?: string;
  variants?: ProductVariantInput[];
  categoryId?: string | null;
  categoryName?: string | null;
  isActive?: boolean;
}) {
  const title = normalizeTitle(data.title);
  await assertTitleAvailable(title);

  const stock = data.variants?.length
    ? data.variants.reduce((sum, v) => sum + v.qty, 0)
    : data.stock;

  const categoryId = await resolveCategoryId({
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  const image = primaryImage(data.images, data.image);

  const row = await prisma.product.create({
    data: {
      title,
      description: data.description?.trim() || title,
      price: data.price,
      stock,
      image,
      color: data.variants?.length ? data.color || data.variants[0].color || null : null,
      size: data.variants?.length ? data.size || data.variants[0].size || null : null,
      isActive: data.isActive ?? true,
      ...(categoryId ? { categoryId } : {}),
      ...(data.variants?.length
        ? { specifications: { create: variantCreates(data.variants) } }
        : {}),
      ...(data.images?.length
        ? { images: { create: imageCreates(data.images) } }
        : data.image
          ? { images: { create: imageCreates([{ url: data.image }]) } }
          : {}),
    },
    include: productInclude,
  });
  return mapProduct(row);
}

export async function updateProduct(
  id: string,
  data: {
    title?: string;
    description?: string;
    price?: number;
    stock?: number;
    image?: string;
    images?: ProductImageInput[];
    color?: string;
    size?: string;
    variants?: ProductVariantInput[];
    categoryId?: string | null;
    categoryName?: string | null;
    isActive?: boolean;
  }
) {
  if (data.title != null) {
    await assertTitleAvailable(normalizeTitle(data.title), id);
  }

  const stock = data.variants?.length
    ? data.variants.reduce((sum, v) => sum + v.qty, 0)
    : data.stock;

  const categoryId = await resolveCategoryId({
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  const image = data.images != null ? primaryImage(data.images, data.image) : data.image;

  const row = await prisma.product.update({
    where: { id },
    data: {
      ...(data.title != null ? { title: normalizeTitle(data.title) } : {}),
      ...(data.description != null ? { description: data.description } : {}),
      ...(data.price != null ? { price: data.price } : {}),
      ...(stock != null ? { stock } : {}),
      ...(image != null ? { image } : {}),
      ...(data.variants != null
        ? {
            color: data.variants[0]?.color || data.color || null,
            size: data.variants[0]?.size || data.size || null,
          }
        : {
            ...(data.color !== undefined ? { color: data.color || null } : {}),
            ...(data.size !== undefined ? { size: data.size || null } : {}),
          }),
      ...(categoryId !== undefined
        ? categoryId
          ? { category: { connect: { id: categoryId } } }
          : { category: { disconnect: true } }
        : {}),
      ...(data.isActive != null ? { isActive: data.isActive } : {}),
    },
  });
  if (data.variants != null) {
    await syncSpecifications(id, data.variants);
  }
  if (data.images != null) {
    await syncImages(id, data.images);
  }
  if (data.isActive === false) {
    await prisma.cartItem.deleteMany({ where: { productId: id } });
  }
  const full = await prisma.product.findUnique({
    where: { id: row.id },
    include: productInclude,
  });
  return mapProduct(full!);
}

export async function deleteProduct(id: string): Promise<{ deactivated: boolean }> {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw productNotFoundError();
  }

  const ordered = await prisma.orderItem.count({ where: { productId: id } });
  if (ordered > 0) {
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.product.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);
    return { deactivated: true };
  }

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  return { deactivated: false };
}

export async function createProductsBulk(
  items: Array<{
    title: string;
    description?: string;
    price: number;
    stock: number;
    image?: string;
  }>
) {
  const seenTitles = new Set<string>();
  for (const item of items) {
    const key = normalizeTitle(item.title).toLowerCase();
    if (seenTitles.has(key)) {
      throw duplicateProductError(item.title);
    }
    seenTitles.add(key);
  }

  const created = [];
  for (const item of items) {
    created.push(await createProduct(item));
  }
  return created;
}
