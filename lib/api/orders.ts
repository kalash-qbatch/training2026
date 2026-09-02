import type { CartItem, ColorFilter, Order, SizeFilter } from "@/types";

/** Browser-safe: loads orders from `/api/orders` (Postgres). */
export async function getOrders(
  page = 1,
  pageSize = 5
): Promise<{
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    size: "all",
    color: "all",
  });
  const res = await fetch(`/api/orders?${params.toString()}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    success?: boolean;
    orders?: Order[];
    total?: number;
    page?: number;
    pageSize?: number;
    sizes?: SizeFilter[];
    colors?: ColorFilter[];
    error?: string;
  };
  if (!res.ok || !data.success || !data.orders) {
    throw new Error(data.error || "Failed to load orders");
  }
  return {
    orders: data.orders,
    total: data.total ?? data.orders.length,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
  };
}

/** Browser-safe: loads one order from `/api/orders/[id]`. */
export async function getOrderById(id: string): Promise<Order | null> {
  const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  const data = (await res.json()) as {
    success?: boolean;
    order?: Order;
    error?: string;
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load order");
  }
  return data.order ?? null;
}

export async function placeOrder(
  items: Array<{
    productId: string;
    specificationId?: string;
    quantity: number;
    color?: string;
    size?: string;
  }>
): Promise<Order> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = (await res.json()) as {
    success?: boolean;
    order?: Order;
    error?: string;
  };
  if (!res.ok || !data.success || !data.order) {
    throw new Error(data.error || "Failed to place order");
  }
  return data.order;
}

/** Validate stock for a cancelled order and add items to cart for checkout. */
export async function reorderCancelledOrder(orderId: string): Promise<CartItem[]> {
  const res = await fetch(`/api/orders/${orderId}/reorder`, {
    method: "POST",
  });
  const data = (await res.json()) as {
    success?: boolean;
    items?: CartItem[];
    error?: string;
  };
  if (!res.ok || !data.success || !data.items) {
    throw new Error(data.error || "Failed to reorder");
  }
  return data.items;
}
