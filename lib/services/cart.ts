import { prisma } from "@/lib/db";
import type { CartItem } from "@/types";

export class CartError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "CartError";
  }
}

function mapCartItem(row: {
  id: string;
  quantity: number;
  productId: string;
  specificationId: string | null;
  product: {
    id: string;
    title: string;
    image: string;
    price: { toString(): string };
    stock: number;
    images: { url: string; color: string | null }[];
  };
  specification: {
    id: string;
    color: string;
    size: string;
    qty: number;
  } | null;
}): CartItem {
  return {
    id: row.id,
    productId: row.product.id,
    specificationId: row.specificationId ?? undefined,
    name: row.product.title,
    imageUrl: row.product.image,
    images: row.product.images.map((img) => ({
      url: img.url,
      color: img.color ?? undefined,
    })),
    color: row.specification?.color || undefined,
    size: row.specification?.size || undefined,
    price: Number(row.product.price),
    qty: row.quantity,
    stock: row.specification ? row.specification.qty : row.product.stock,
  };
}

async function resolveLine(
  productId: string,
  specificationId?: string | null
): Promise<{ title: string; stock: number; specificationId?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { specifications: true },
  });
  if (!product) throw new CartError("Product not found", 404);
  if (!product.isActive) {
    throw new CartError(`"${product.title}" is no longer available.`);
  }

  if (product.specifications.length > 0) {
    if (!specificationId) {
      throw new CartError(
        `A variant selection is required for "${product.title}".`
      );
    }
    const spec = product.specifications.find((s) => s.id === specificationId);
    if (!spec) {
      throw new CartError(
        `Selected variant is unavailable for "${product.title}".`
      );
    }
    return { title: product.title, stock: spec.qty, specificationId: spec.id };
  }

  return { title: product.title, stock: product.stock };
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: { include: { images: true } },
      specification: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapCartItem);
}

export async function addToCart(
  userId: string,
  input: {
    productId: string;
    specificationId?: string | null;
    quantity: number;
  }
): Promise<CartItem[]> {
  const qty = Math.floor(input.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    throw new CartError("Quantity must be at least 1");
  }

  const specId = input.specificationId?.trim() || null;
  const resolved = await resolveLine(input.productId, specId);
  const { title, stock } = resolved;

  if (stock <= 0) {
    throw new CartError(`"${title}" is out of stock`);
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      userId,
      productId: input.productId,
      specificationId: specId,
    },
  });

  const nextQty = (existing?.quantity ?? 0) + qty;
  if (nextQty > stock) {
    const current = existing?.quantity ?? 0;
    const left = stock - current;
    if (left <= 0) {
      throw new CartError(
        `Only ${stock} in stock. You already have ${current} in cart.`
      );
    }
    throw new CartError(`Only ${stock} in stock. You can add ${left} more.`);
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQty },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        userId,
        productId: input.productId,
        specificationId: specId,
        quantity: qty,
      },
    });
  }

  return getCart(userId);
}

export async function updateCartItem(
  userId: string,
  input: {
    productId: string;
    specificationId?: string | null;
    quantity: number;
  }
): Promise<CartItem[]> {
  const qty = Math.floor(input.quantity);

  if (!Number.isFinite(qty) || qty < 1) {
    throw new CartError("Quantity must be at least 1");
  }

  const specId = input.specificationId?.trim() || null;
  const { title, stock } = await resolveLine(input.productId, specId);
  if (qty > stock) {
    throw new CartError(`Only ${stock} in stock for "${title}".`);
  }

  const updated = await prisma.cartItem.updateMany({
    where: {
      userId,
      productId: input.productId,
      specificationId: specId,
    },
    data: { quantity: qty },
  });
  if (updated.count === 0) {
    throw new CartError("Cart item not found", 404);
  }

  return getCart(userId);
}

export async function removeCartItem(
  userId: string,
  input: { productId: string; specificationId?: string | null }
): Promise<CartItem[]> {
  const specId = input.specificationId?.trim() || null;

  await prisma.cartItem.deleteMany({
    where: {
      userId,
      productId: input.productId,
      specificationId: specId,
    },
  });

  return getCart(userId);
}

export async function removeCartItems(
  userId: string,
  items: Array<{ productId: string; specificationId?: string | null }>
): Promise<CartItem[]> {
  for (const item of items) {
    const specId = item.specificationId?.trim() || null;
    await prisma.cartItem.deleteMany({
      where: {
        userId,
        productId: item.productId,
        specificationId: specId,
      },
    });
  }
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartItem[]> {
  await prisma.cartItem.deleteMany({ where: { userId } });
  return [];
}
