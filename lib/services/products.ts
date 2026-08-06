import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  duplicateProductError,
  productNotFoundError,
} from "@/lib/errors/products";
import { mapProduct } from "@/lib/mappers";
import type { Product } from "@/types";

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
export type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
export type SizeFilter = "all" | "s" | "m" | "l" | "xl" | "xxl";
export type ColorFilter = "all" | "red" | "blue" | "green" | "yellow" | "purple" | "orange" | "pink" | "brown" | "gray" | "black" | "white";

export async function findProducts(opts?: {
  search?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 8;
  const q = opts?.search?.trim();
  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

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
      include: { specifications: true },
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

export async function findProductById(id: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: { specifications: true },
  });
  return row ? mapProduct(row) : null;
}

function parsePriceFilter(value?: number): Prisma.Decimal | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  return new Prisma.Decimal(value.toFixed(2));
}

function stockWhere(stock?: StockFilter): Prisma.ProductWhereInput {
  if (!stock || stock === "all") return {};
  if (stock === "out_of_stock") return { stock: { lte: 0 } };
  if (stock === "low_stock") return { stock: { gt: 0, lte: 10 } };
  if (stock === "in_stock") return { stock: { gt: 0 } };
  return {};
}

export async function findAdminProducts(opts: {
  search?: string;
  stock?: StockFilter;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 8;
  const q = opts.search?.trim();
  const minPrice = parsePriceFilter(opts.minPrice);
  const maxPrice = parsePriceFilter(opts.maxPrice);

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
      stockWhere(opts.stock),
      minPrice != null ? { price: { gte: minPrice } } : {},
      maxPrice != null ? { price: { lte: maxPrice } } : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { specifications: true },
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
}) {
  const title = normalizeTitle(data.title);
  await assertTitleAvailable(title);

  const stock =
    data.variants?.length
      ? data.variants.reduce((sum, v) => sum + v.qty, 0)
      : data.stock;

  const row = await prisma.product.create({
    data: {
      title,
      description: data.description?.trim() || title,
      price: data.price,
      stock,
      image: data.image || "/products/tee.jpg",
      color: data.color ?? data.variants?.[0]?.color,
      size: data.size ?? data.variants?.[0]?.size,
      ...(data.variants?.length
        ? { specifications: { create: variantCreates(data.variants) } }
        : {}),
    },
    include: { specifications: true },
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
  }
) {
  if (data.title != null) {
    await assertTitleAvailable(normalizeTitle(data.title), id);
  }

  const stock =
    data.variants != null
      ? data.variants.reduce((sum, v) => sum + v.qty, 0)
      : data.stock;

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
    },
  });
  if (data.variants != null) {
    await syncSpecifications(id, data.variants);
  }
  const full = await prisma.product.findUnique({
    where: { id: row.id },
    include: { specifications: true },
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

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.orderItem.deleteMany({ where: { productId: id } }),
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
