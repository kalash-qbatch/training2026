import type { CartItem } from "@/types";

export const mockCartItem: CartItem = {
  id: "cart-line-001",
  productId: "prod-001",
  specificationId: "spec-001",
  name: "Classic Tee",
  imageUrl: "/products/tee.jpg",
  color: "black",
  size: "M",
  price: 29.99,
  qty: 2,
  stock: 10,
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
};

export const mockCartItems: CartItem[] = [mockCartItem];
