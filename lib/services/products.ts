import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { duplicateProductError } from "@/lib/errors/products";
import { mapProduct } from "@/lib/mappers";
import { resolveCategoryId } from "@/lib/services/categories";
import {
  allocateProductCode,
  buildVariantSku,
  ensureColorAndSizeCatalog,
  ensureColorExists,
  ensureSizeExists,
  extractTitlePrefix,
  loadColorSizeLists,
} from "@/lib/services/sku";
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

function skuSearchWhere(q: string): Prisma.ProductWhereInput {
  const parts = q.toUpperCase().split("-").filter(Boolean);
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { titlePrefix: { equals: q.toUpperCase(), mode: "insensitive" } },
      { code: { equals: q.padStart(3, "0") } },
      ...(parts.length >= 2
        ? [
            {
              AND: [
                { titlePrefix: { equals: parts[0], mode: "insensitive" as const } },
                { code: { equals: parts[1].padStart(3, "0") } },
              ],
            },
          ]
        : []),
      {
        specifications: {
          some: { sku: { contains: q, mode: "insensitive" } },
        },
      },
    ],
  };
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
      q ? skuSearchWhere(q) : {},
      opts?.categoryId ? { categoryId: opts.categoryId } : {},
      opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {},
    ],
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    opts?.sort === "price-asc"
      ? { price: "asc" }
      : opts?.sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

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
      q ? skuSearchWhere(q) : {},
      opts.categoryId ? { categoryId: opts.categoryId } : {},
      opts.isActive != null ? { isActive: opts.isActive } : {},
    ],
  };

  const [total, rows, totalProducts, addedLast24h] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: productInclude,
    }),
    prisma.product.count(),
    prisma.product.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return {
    products: rows.map(mapProduct),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      totalProducts,
      addedLast24h,
    },
  };
}

type ProductVariantInput = { color: string; size: string; qty: number };
type ProductImageInput = { url: string; color?: string };

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

async function syncSpecifications(
  productId: string,
  titlePrefix: string,
  productCode: string,
  variants?: ProductVariantInput[],
  options?: { addQty?: boolean }
) {
  const addQty = Boolean(options?.addQty);
  const existing = await prisma.specification.findMany({
    where: { productId },
  });
  const lists = await loadColorSizeLists();

  const sizeKey = (size: string) => {
    const s = (size ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_\-]+/g, "");
    if (!s || s === "na" || s === "n/a" || s === "none" || s === "freesize" || s === "onesize") {
      return "freesize";
    }
    return s;
  };
  const colorKey = (color: string) =>
    (color ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_\-]+/g, "");
  const canonicalSize = (size: string) => {
    const raw = (size ?? "").trim();
    return sizeKey(raw) === "freesize" ? "Free Size" : raw;
  };

  if (!variants?.length) {
    if (addQty) {
      const agg = await prisma.specification.aggregate({
        where: { productId },
        _sum: { qty: true },
      });
      await prisma.product.update({
        where: { id: productId },
        data: { stock: agg._sum.qty ?? 0 },
      });
      return;
    }
    const existingIds = existing.map((s) => s.id);
    if (existingIds.length) {
      await prisma.cartItem.deleteMany({
        where: { specificationId: { in: existingIds } },
      });
      await prisma.specification.deleteMany({ where: { productId } });
    }
    await prisma.product.update({
      where: { id: productId },
      data: { stock: 0 },
    });
    return;
  }

  const incomingKeys = new Set(
    variants.map((v) => `${colorKey(v.color ?? "")}::${sizeKey(v.size ?? "")}`)
  );

  // Bulk restock keeps other variants; edit/replace mode removes missing ones
  if (!addQty) {
    const toDelete = existing.filter(
      (s) => !incomingKeys.has(`${colorKey(s.color ?? "")}::${sizeKey(s.size ?? "")}`)
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
  }

  const remaining = await prisma.specification.findMany({ where: { productId } });

  for (const v of variants) {
    const color = (v.color ?? "").trim();
    const size = canonicalSize(v.size ?? "");
    const match = remaining.find(
      (s) => colorKey(s.color ?? "") === colorKey(color) && sizeKey(s.size ?? "") === sizeKey(size)
    );
    const sku = await buildVariantSku(titlePrefix, productCode, color, size, lists);
    await ensureColorExists(prisma as never, color);
    await ensureSizeExists(prisma as never, size);

    if (match) {
      await prisma.specification.update({
        where: { id: match.id },
        data: {
          qty: addQty ? match.qty + v.qty : v.qty,
          sku,
          color,
          size,
        },
      });
    } else {
      await prisma.specification.create({
        data: {
          productId,
          color,
          size,
          qty: v.qty,
          sku,
        },
      });
    }
  }

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
  const seen = new Set<string>();
  const unique = images.filter((img) => {
    const url = img.url?.trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      images: {
        deleteMany: {},
        ...(unique.length ? { create: imageCreates(unique) } : {}),
      },
      ...(unique[0]?.url ? { image: unique[0].url } : {}),
    },
  });
}

export async function createProduct(data: {
  title: string;
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

  const row = await prisma.$transaction(async (tx) => {
    await ensureColorAndSizeCatalog(tx);
    const { titlePrefix, code } = await allocateProductCode(tx, title);
    const lists = await loadColorSizeLists(tx);

    const variants = data.variants?.length
      ? await Promise.all(
          data.variants.map(async (v) => {
            await ensureColorExists(tx, v.color);
            await ensureSizeExists(tx, v.size);
            const sku = await buildVariantSku(titlePrefix, code, v.color, v.size, lists);
            return {
              color: v.color.trim(),
              size: v.size.trim(),
              qty: v.qty,
              sku,
            };
          })
        )
      : [];

    return tx.product.create({
      data: {
        title,
        titlePrefix,
        code,
        price: data.price,
        stock,
        image,
        color: variants.length ? data.color || variants[0].color || null : null,
        size: variants.length ? data.size || variants[0].size || null : null,
        isActive: data.isActive ?? true,
        ...(categoryId ? { categoryId } : {}),
        ...(variants.length ? { specifications: { create: variants } } : {}),
        ...(data.images?.length
          ? { images: { create: imageCreates(data.images) } }
          : data.image
            ? { images: { create: imageCreates([{ url: data.image }]) } }
            : {}),
      },
      include: productInclude,
    });
  });

  return mapProduct(row);
}

export async function updateProduct(
  id: string,
  data: {
    title?: string;
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
    /** When true, variant qtys are added to existing stock (bulk restock). */
    addStock?: boolean;
  }
) {
  if (data.title != null) {
    await assertTitleAvailable(normalizeTitle(data.title), id);
  }

  const stock = data.addStock
    ? undefined
    : data.variants?.length
      ? data.variants.reduce((sum, v) => sum + v.qty, 0)
      : data.stock;

  const categoryId = await resolveCategoryId({
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  const image = data.images != null ? primaryImage(data.images, data.image) : data.image;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found");

  let titlePrefix = existing.titlePrefix;
  let code = existing.code;

  if (data.title != null) {
    const newTitle = normalizeTitle(data.title);
    const newPrefix = extractTitlePrefix(newTitle);
    // Only re-allocate when an existing prefix is changing to a different one
    if (existing.titlePrefix && newPrefix !== existing.titlePrefix) {
      const allocated = await prisma.$transaction(async (tx) => {
        await ensureColorAndSizeCatalog(tx);
        return allocateProductCode(tx, newTitle);
      });
      titlePrefix = allocated.titlePrefix;
      code = allocated.code;
    }
  }

  if (!titlePrefix || !code) {
    const allocated = await prisma.$transaction(async (tx) => {
      await ensureColorAndSizeCatalog(tx);
      return allocateProductCode(tx, data.title ? normalizeTitle(data.title) : existing.title);
    });
    titlePrefix = allocated.titlePrefix;
    code = allocated.code;
  }

  const row = await prisma.product.update({
    where: { id },
    data: {
      ...(data.title != null ? { title: normalizeTitle(data.title) } : {}),
      titlePrefix,
      code,
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
    await syncSpecifications(id, titlePrefix!, code!, data.variants, {
      addQty: Boolean(data.addStock),
    });
  } else if (data.title != null && titlePrefix && code) {
    const specs = await prisma.specification.findMany({ where: { productId: id } });
    const lists = await loadColorSizeLists();
    for (const s of specs) {
      const sku = await buildVariantSku(titlePrefix, code, s.color, s.size, lists);
      await prisma.specification.update({ where: { id: s.id }, data: { sku } });
    }
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

export async function createProductsBulk(
  items: Array<{
    title: string;
    price: number;
    stock: number;
    image?: string;
    images?: ProductImageInput[];
    color?: string;
    size?: string;
    variants?: ProductVariantInput[];
    categoryName?: string | null;
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

export async function findProductBySkuLookup(sku: string) {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const byVariant = await prisma.specification.findFirst({
    where: { sku: { equals: trimmed, mode: "insensitive" } },
    include: { product: { include: productInclude } },
  });
  if (byVariant?.product) {
    return {
      product: mapProduct(byVariant.product),
      specificationId: byVariant.id,
      matchedSku: byVariant.sku,
    };
  }

  const parts = trimmed.toUpperCase().split("-");
  if (parts.length >= 2) {
    const titlePrefix = parts[0];
    const code = parts[1].padStart(3, "0");
    const product = await prisma.product.findFirst({
      where: { titlePrefix, code },
      include: productInclude,
    });
    if (product) {
      return {
        product: mapProduct(product),
        specificationId: undefined,
        matchedSku: `${titlePrefix}-${code}`,
      };
    }
  }

  return null;
}

export async function validateSkus(skus: string[]) {
  const matched: Array<{
    sku: string;
    productId: string;
    productTitle: string;
    specificationId?: string;
    existingVariants: Array<{ color: string; size: string; sku?: string }>;
  }> = [];
  const unmatched: string[] = [];
  const variantsByProduct = new Map<string, Array<{ color: string; size: string; sku?: string }>>();

  for (const raw of skus) {
    const sku = raw.trim();
    if (!sku) continue;
    const hit = await findProductBySkuLookup(sku);
    if (hit) {
      let existingVariants = variantsByProduct.get(hit.product.id);
      if (!existingVariants) {
        existingVariants = (hit.product.variants ?? []).map((v) => ({
          color: v.color,
          size: v.size,
          sku: v.sku,
        }));
        variantsByProduct.set(hit.product.id, existingVariants);
      }
      matched.push({
        sku,
        productId: hit.product.id,
        productTitle: hit.product.name,
        specificationId: hit.specificationId,
        existingVariants,
      });
    } else {
      unmatched.push(sku);
    }
  }

  return { matched, unmatched };
}
