import {
  addToCart,
  CartError,
  clearCart,
  getCart,
  removeCartItem,
  removeCartItems,
  updateCartItem,
} from "@/lib/services/cart";
import { requireUser } from "@/lib/controllers/http";

function cartErrorResult(err: unknown) {
  if (err instanceof CartError) {
    return {
      status: err.status,
      body: { success: false, error: err.message },
    };
  }
  return null;
}

export async function listCart() {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const items = await getCart(userId);
  return { status: 200, body: { success: true, items } };
}

export async function addCartItem(body: unknown) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const data = body as {
    productId?: string;
    specificationId?: string;
    quantity?: number;
  };
  if (!data.productId) {
    return {
      status: 400,
      body: { success: false, error: "productId is required" },
    };
  }

  try {
    const items = await addToCart(userId, {
      productId: data.productId,
      specificationId: data.specificationId,
      quantity: data.quantity ?? 1,
    });
    return { status: 200, body: { success: true, items } };
  } catch (err) {
    const mapped = cartErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}

export async function patchCartItem(body: unknown) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const data = body as {
    productId?: string;
    specificationId?: string;
    quantity?: number;
  };
  if (!data.productId || data.quantity == null) {
    return {
      status: 400,
      body: { success: false, error: "productId and quantity are required" },
    };
  }

  try {
    const items = await updateCartItem(userId, {
      productId: data.productId,
      specificationId: data.specificationId,
      quantity: data.quantity,
    });
    return { status: 200, body: { success: true, items } };
  } catch (err) {
    const mapped = cartErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}

export async function deleteCartItems(request: Request) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  try {
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get("all") === "1";
    if (clearAll) {
      const items = await clearCart(userId);
      return { status: 200, body: { success: true, items } };
    }

    const body = (await request.json().catch(() => null)) as
      | {
          productId?: string;
          specificationId?: string;
          items?: Array<{ productId: string; specificationId?: string }>;
        }
      | null;

    if (body?.items?.length) {
      const items = await removeCartItems(userId, body.items);
      return { status: 200, body: { success: true, items } };
    }

    if (!body?.productId) {
      return {
        status: 400,
        body: { success: false, error: "productId is required" },
      };
    }

    const items = await removeCartItem(userId, {
      productId: body.productId,
      specificationId: body.specificationId,
    });
    return { status: 200, body: { success: true, items } };
  } catch (err) {
    const mapped = cartErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
}
