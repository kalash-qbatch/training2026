import rawProducts from "../data/products.json";
import type { CatalogItem } from "../types";

export interface ChatCartLineItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
  lineTotal: number;
}

export interface ChatCartSummary {
  items: ChatCartLineItem[];
  totalQuantity: number;
  subtotal: number;
  formattedSubtotal: string;
}

const catalog: CatalogItem[] = rawProducts as CatalogItem[];

// Session-based cart storage (persists per session / guest / user)
const sessionCarts = new Map<string, Map<string, ChatCartLineItem>>();

function getOrCreateSessionCart(sessionId: string): Map<string, ChatCartLineItem> {
  let cart = sessionCarts.get(sessionId);
  if (!cart) {
    cart = new Map<string, ChatCartLineItem>();
    sessionCarts.set(sessionId, cart);
  }
  return cart;
}

export class ChatCartError extends Error {
  constructor(
    message: string,
    public code:
      "OUT_OF_STOCK" | "NOT_FOUND" | "LIMIT_EXCEEDED" | "INVALID_INPUT" = "INVALID_INPUT",
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ChatCartError";
  }
}

/**
 * Adds an item to the session cart, validating existence and stock.
 */
export async function addToCart(
  sessionId: string,
  productId: string,
  quantity = 1,
  variant?: string
): Promise<{ added: ChatCartLineItem; cart: ChatCartSummary }> {
  if (quantity <= 0) {
    throw new ChatCartError("Quantity must be greater than zero.", "INVALID_INPUT", 400);
  }

  const product = catalog.find((p) => p.id === productId.trim());
  if (!product) {
    throw new ChatCartError(`Product with ID "${productId}" not found.`, "NOT_FOUND", 404);
  }

  if (product.stock <= 0) {
    throw new ChatCartError(`"${product.name}" is currently out of stock.`, "OUT_OF_STOCK", 400);
  }

  const cart = getOrCreateSessionCart(sessionId);
  const lineKey = variant ? `${productId}::${variant}` : productId;
  const existing = cart.get(lineKey);
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + quantity;

  if (newQty > product.stock) {
    throw new ChatCartError(
      `Cannot add ${quantity} more. Only ${product.stock - currentQty} available in stock.`,
      "LIMIT_EXCEEDED",
      400
    );
  }

  const lineTotal = Number((newQty * product.price).toFixed(2));
  const lineItem: ChatCartLineItem = {
    id: lineKey,
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: newQty,
    image: product.image,
    variant,
    lineTotal,
  };

  cart.set(lineKey, lineItem);
  return {
    added: lineItem,
    cart: getCartSummary(sessionId),
  };
}

/**
 * Removes an item from the cart.
 */
export async function removeFromCart(
  sessionId: string,
  productId: string,
  variant?: string
): Promise<{ removed: boolean; cart: ChatCartSummary }> {
  const cart = getOrCreateSessionCart(sessionId);
  const lineKey = variant ? `${productId}::${variant}` : productId;

  let removed = false;
  if (cart.has(lineKey)) {
    cart.delete(lineKey);
    removed = true;
  } else {
    // If no variant specified, check if any line matching productId exists
    for (const [key, item] of cart.entries()) {
      if (item.productId === productId) {
        cart.delete(key);
        removed = true;
      }
    }
  }

  return {
    removed,
    cart: getCartSummary(sessionId),
  };
}

/**
 * Returns formatted cart summary.
 */
export function getCartSummary(sessionId: string): ChatCartSummary {
  const cart = getOrCreateSessionCart(sessionId);
  const items = Array.from(cart.values());
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

  return {
    items,
    totalQuantity,
    subtotal,
    formattedSubtotal: `$${subtotal.toFixed(2)}`,
  };
}

/**
 * Empties the session cart (e.g. after checkout or tests).
 */
export function clearSessionCart(sessionId: string) {
  sessionCarts.delete(sessionId);
}
