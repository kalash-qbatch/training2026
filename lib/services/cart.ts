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

function normalizeVariant(value?: string | null) {
  return value?.trim() ?? "";
}

function mapCartItem(row: {
  quantity: number;
  color: string;
  size: string;
  product: {
    id: string;
    title: string;
    image: string;
    price: { toString(): string };
    stock: number;
    specifications?: Array<{ color: string; size: string; qty: number }>;
  };
}): CartItem {
  const specs = row.product.specifications ?? [];
  let stock = row.product.stock;
  if (specs.length && row.color && row.size) {
    const match = specs.find(
      (s) =>
        s.color.toLowerCase() === row.color.toLowerCase() &&
        s.size.toLowerCase() === row.size.toLowerCase()
    );
    stock = match?.qty ?? 0;
  } else if (specs.length) {
    stock = specs.reduce((sum, s) => sum + s.qty, 0);
  }

  return {
    productId: row.product.id,
    name: row.product.title,
    imageUrl: row.product.image,
    color: row.color || undefined,
    size: row.size || undefined,
    price: Number(row.product.price),
    qty: row.quantity,
    stock,
  };
}

async function resolveLine(
  productId: string,
  color: string,
  size: string
): Promise<{ title: string; stock: number; color: string; size: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { specifications: true },
  });
  if (!product) throw new CartError("Product not found", 404);
  if (!product.isActive) {
    throw new CartError(`"${product.title}" is no longer available.`);
  }

  if (!product.specifications.length) {
    return { title: product.title, stock: product.stock, color: "", size: "" };
  }

  if (!color || !size) {
    throw new CartError(`Color and size are required for "${product.title}".`);
  }
  const spec = product.specifications.find(
    (s) =>
      s.color.toLowerCase() === color.toLowerCase() &&
      s.size.toLowerCase() === size.toLowerCase()
  );
  if (!spec) {
    throw new CartError(
      `Selected color/size is unavailable for "${product.title}".`
    );
  }
  return { title: product.title, stock: spec.qty, color, size };
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: { include: { specifications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapCartItem);
}

export async function addToCart(
  userId: string,
  input: {
    productId: string;
    quantity: number;
    color?: string;
    size?: string;
  }
): Promise<CartItem[]> {
  const qty = Math.floor(input.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    throw new CartError("Quantity must be at least 1");
  }

  const resolved = await resolveLine(
    input.productId,
    normalizeVariant(input.color),
    normalizeVariant(input.size)
  );
  const { title, stock, color, size } = resolved;

  if (stock <= 0) {
    throw new CartError(`"${title}" is out of stock`);
  }

  const existing = await prisma.cartItem.findUnique({
    where: {
      userId_productId_color_size: {
        userId,
        productId: input.productId,
        color,
        size,
      },
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

  await prisma.cartItem.upsert({
    where: {
      userId_productId_color_size: {
        userId,
        productId: input.productId,
        color,
        size,
      },
    },
    create: {
      userId,
      productId: input.productId,
      color,
      size,
      quantity: qty,
    },
    update: { quantity: nextQty },
  });

  return getCart(userId);
}

export async function updateCartItem(
  userId: string,
  input: {
    productId: string;
    quantity: number;
    color?: string;
    size?: string;
  }
): Promise<CartItem[]> {
  const qty = Math.floor(input.quantity);

  if (!Number.isFinite(qty) || qty < 1) {
    throw new CartError("Quantity must be at least 1");
  }

  const { title, stock, color, size } = await resolveLine(
    input.productId,
    normalizeVariant(input.color),
    normalizeVariant(input.size)
  );
  if (qty > stock) {
    throw new CartError(`Only ${stock} in stock for "${title}".`);
  }

  const updated = await prisma.cartItem.updateMany({
    where: { userId, productId: input.productId, color, size },
    data: { quantity: qty },
  });
  if (updated.count === 0) {
    throw new CartError("Cart item not found", 404);
  }

  return getCart(userId);
}

export async function removeCartItem(
  userId: string,
  input: { productId: string; color?: string; size?: string }
): Promise<CartItem[]> {
  const color = normalizeVariant(input.color);
  const size = normalizeVariant(input.size);

  await prisma.cartItem.deleteMany({
    where: { userId, productId: input.productId, color, size },
  });

  return getCart(userId);
}

export async function removeCartItems(
  userId: string,
  items: Array<{ productId: string; color?: string; size?: string }>
): Promise<CartItem[]> {
  for (const item of items) {
    await prisma.cartItem.deleteMany({
      where: {
        userId,
        productId: item.productId,
        color: normalizeVariant(item.color),
        size: normalizeVariant(item.size),
      },
    });
  }
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartItem[]> {
  await prisma.cartItem.deleteMany({ where: { userId } });
  return [];
}
