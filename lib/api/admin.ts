import type { AdminOrderStats, Category, Product, Order } from "@/types";

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json()) as T & { error?: string };
}

export async function fetchAdminProducts(params: {
  search?: string;
  categoryId?: string;
  page?: number;
}) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.categoryId) q.set("categoryId", params.categoryId);
  q.set("page", String(params.page ?? 1));

  const res = await fetch(`/api/admin/products?${q}`);
  const data = await parseJson<{
    success: boolean;
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Failed to load products");
  return data;
}

export async function fetchAdminCategories() {
  const res = await fetch("/api/admin/categories");
  const data = await parseJson<{ success: boolean; categories: Category[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load categories");
  }
  return data.categories;
}

export async function createAdminCategory(name: string) {
  const res = await fetch("/api/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await parseJson<{ success: boolean; category: Category }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to create category");
  }
  return data.category;
}

export async function createAdminProduct(body: {
  title: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  size?: string;
  color?: string;
  variants?: Array<{ color: string; size: string; qty: number }>;
  categoryId?: string | null;
  categoryName?: string | null;
}) {
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; product: Product }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Create failed");
  return data.product;
}

export async function updateAdminProduct(
  id: string,
  body: {
    title: string;
    description?: string;
    price: number;
    stock: number;
    image?: string;
    size?: string;
    color?: string;
    variants?: Array<{ color: string; size: string; qty: number }>;
    categoryId?: string | null;
    categoryName?: string | null;
  }
) {
  const res = await fetch(`/api/admin/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; product: Product }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Update failed");
  return data.product;
}

export async function deleteAdminProduct(id: string) {
  const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
  const data = await parseJson<{ success: boolean }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
}

export async function bulkUploadProducts(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/products/bulk", {
    method: "POST",
    body: form,
  });
  const data = await parseJson<{ success: boolean; message?: string }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Bulk upload failed");
  return data;
}

export async function uploadAdminImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = await parseJson<{ success: boolean; url?: string }>(res);
  if (!res.ok || !data.success || !data.url) {
    throw new Error(data.error || "Upload failed");
  }
  return data.url;
}

export async function fetchAdminOrders(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") q.set(k, String(v));
  });
  const res = await fetch(`/api/admin/orders?${q}`);
  const data = await parseJson<{
    success: boolean;
    orders: Order[];
    total: number;
    page: number;
    totalPages: number;
    stats: AdminOrderStats;
  }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Failed to load orders");
  return data;
}

export async function fetchAdminOrder(id: string) {
  const res = await fetch(`/api/admin/orders/${id}`);
  const data = await parseJson<{ success: boolean; order: Order }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Failed to load order");
  return data.order;
}

export type AdminOrderStatusUpdate =
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export async function updateAdminOrderStatus(
  id: string,
  status: AdminOrderStatusUpdate
) {
  const res = await fetch(`/api/admin/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await parseJson<{ success: boolean; order: Order }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update order status");
  }
  return data.order;
}
