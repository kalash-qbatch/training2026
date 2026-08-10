import type { CartItem } from "@/types";

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json()) as T & { error?: string };
}

export async function fetchCart(): Promise<CartItem[]> {
  const res = await fetch("/api/cart", { cache: "no-store" });
  if (res.status === 401) return [];
  const data = await parseJson<{ success: boolean; items: CartItem[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load cart");
  }
  return data.items ?? [];
}

export async function addCartItem(body: {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
}): Promise<CartItem[]> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; items: CartItem[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to add to cart");
  }
  return data.items ?? [];
}

export async function updateCartItemApi(body: {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
}): Promise<CartItem[]> {
  const res = await fetch("/api/cart", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; items: CartItem[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update cart");
  }
  return data.items ?? [];
}

export async function removeCartItemApi(body: {
  productId: string;
  color?: string;
  size?: string;
}): Promise<CartItem[]> {
  const res = await fetch("/api/cart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; items: CartItem[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to remove cart item");
  }
  return data.items ?? [];
}

export async function removeCartItemsApi(
  items: Array<{ productId: string; color?: string; size?: string }>
): Promise<CartItem[]> {
  const res = await fetch("/api/cart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await parseJson<{ success: boolean; items: CartItem[] }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update cart");
  }
  return data.items ?? [];
}
