import type { ColorFilter, Product, ProductSort, SizeFilter } from "@/types";

export type { ProductSort };

/** Browser-safe: loads products from `/api/products` (Postgres). */
export async function getProducts(opts?: {
  search?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  categorySlug?: string;
  sizeFilters?: SizeFilter[];
  colorFilters?: ColorFilter[];
  signal?: AbortSignal;
}): Promise<{
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.categoryId) params.set("categoryId", opts.categoryId);
  if (opts?.categorySlug) params.set("category", opts.categorySlug);

  const res = await fetch(`/api/products?${params.toString()}`, {
    cache: "no-store",
    signal: opts?.signal,
  });
  const data = (await res.json()) as {
    success?: boolean;
    products?: Product[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    error?: string;
  };
  if (!res.ok || !data.success || !data.products) {
    throw new Error(data.error || "Failed to load products");
  }
  return {
    products: data.products,
    total: data.total ?? data.products.length,
    page: data.page ?? opts?.page ?? 1,
    pageSize: data.pageSize ?? opts?.pageSize ?? 8,
    totalPages: data.totalPages ?? 1,
  };
}

/** Browser-safe: loads one product from `/api/products/[id]`. */
export async function getProductById(id: string): Promise<Product | null> {
  const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  const data = (await res.json()) as {
    success?: boolean;
    product?: Product;
    error?: string;
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load product");
  }
  return data.product ?? null;
}

export async function getCategories() {
  const res = await fetch("/api/categories", { cache: "no-store" });
  const data = (await res.json()) as {
    success?: boolean;
    categories?: Array<{ id: string; name: string; slug: string }>;
    error?: string;
  };
  if (!res.ok || !data.success || !data.categories) {
    throw new Error(data.error || "Failed to load categories");
  }
  return data.categories;
}
