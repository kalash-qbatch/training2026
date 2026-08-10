import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  duplicateProductError,
  productNotFoundError,
} from "@/lib/errors/products";
import { mapProduct } from "@/lib/mappers";
import { resolveCategoryId } from "@/lib/services/categories";
import type { Product } from "@/types";

const productInclude = {
  specifications: true,
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

export type ProductSort = "price-asc" | "price-desc" | "name-asc";
export type SizeFilter = "all" | "s" | "m" | "l" | "xl" | "xxl";
export type ColorFilter = "all" | "red" | "blue" | "green" | "yellow" | "purple" | "orange" | "pink" | "brown" | "gray" | "black" | "white";

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
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      opts?.categoryId ? { categoryId: opts.categoryId } : {},
      opts?.categorySlug
        ? { category: { slug: opts.categorySlug } }
        : {},
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

  // Heal Product.stock if Studio/manual edits drifted from Specification.qty
  await Promise.all(
    rows.map(async (row) => {
      if (!row.specifications.length) return;
      const sum = row.specifications.reduce((acc, s) => acc + s.qty, 0);
      if (row.stock !== sum) {
        await reconcileProductStock(row.id);
        row.stock = sum;
      }
    })
  );

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
  return row ? mapProduct(row) : null;
}

export async function findAdminProducts(opts: {
  search?: string;
  categoryId?: string;
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

function variantCreates(variants: ProductVariantInput[]) {
  return variants.map((v) => ({
    color: v.color.trim(),
    size: v.size.trim(),
    qty: v.qty,
  }));
}

async function syncSpecifications(
  productId: string,
  variants?: ProductVariantInput[]
) {
  await prisma.product.update({
    where: { id: productId },
    data: {
      specifications: {
        deleteMany: {},
        ...(variants?.length
          ? { create: variantCreates(variants) }
          : {}),
      },
    },
  });

  const agg = await prisma.specification.aggregate({
    where: { productId },
    _sum: { qty: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { stock: agg._sum.qty ?? 0 },
  });
}

/** Keep Product.stock column aligned with Specification qtys (API source of truth). */
async function reconcileProductStock(productId: string) {
  const specs = await prisma.specification.findMany({
    where: { productId },
    select: { qty: true },
  });
  if (!specs.length) return;
  const sum = specs.reduce((acc, s) => acc + s.qty, 0);
  await prisma.product.update({
    where: { id: productId },
    data: { stock: sum },
  });
}

export async function createProduct(data: {
  title: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  color?: string;
  size?: string;
  variants?: ProductVariantInput[];
  categoryId?: string | null;
  categoryName?: string | null;
}) {
  const title = normalizeTitle(data.title);
  await assertTitleAvailable(title);

  const stock =
    data.variants?.length
      ? data.variants.reduce((sum, v) => sum + v.qty, 0)
      : data.stock;

  const categoryId = await resolveCategoryId({
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });

  const row = await prisma.product.create({
    data: {
      title,
      description: data.description?.trim() || title,
      price: data.price,
      stock,
      image: data.image || "/products/tee.jpg",
      color: data.color ?? data.variants?.[0]?.color,
      size: data.size ?? data.variants?.[0]?.size,
      ...(categoryId ? { categoryId } : {}),
      ...(data.variants?.length
        ? { specifications: { create: variantCreates(data.variants) } }
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
    color?: string;
    size?: string;
    variants?: ProductVariantInput[];
    categoryId?: string | null;
    categoryName?: string | null;
  }
) {
  if (data.title != null) {
    await assertTitleAvailable(normalizeTitle(data.title), id);
  }

  const stock =
    data.variants != null
      ? data.variants.reduce((sum, v) => sum + v.qty, 0)
      : data.stock;

  const categoryId = await resolveCategoryId({
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });

  const row = await prisma.product.update({
    where: { id },
    data: {
      ...(data.title != null ? { title: normalizeTitle(data.title) } : {}),
      ...(data.description != null ? { description: data.description } : {}),
      ...(data.price != null ? { price: data.price } : {}),
      ...(stock != null ? { stock } : {}),
      ...(data.image != null ? { image: data.image } : {}),
      ...(data.color != null || data.variants?.[0]?.color
        ? { color: data.color ?? data.variants?.[0]?.color }
        : {}),
      ...(data.size != null || data.variants?.[0]?.size
        ? { size: data.size ?? data.variants?.[0]?.size }
        : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
  });
  if (data.variants != null) {
    await syncSpecifications(id, data.variants);
  }
  const full = await prisma.product.findUnique({
    where: { id: row.id },
    include: productInclude,
  });
  return mapProduct(full!);
}

export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw productNotFoundError();
  }

  const ordered = await prisma.orderItem.count({ where: { productId: id } });
  if (ordered > 0) {
    const err = new Error(
      "Cannot delete this product because it appears in past orders. Update stock to 0 instead."
    ) as Error & { code: string };
    err.code = "PRODUCT_IN_ORDERS";
    throw err;
  }

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
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
