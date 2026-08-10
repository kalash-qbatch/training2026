import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addToCart,
  CartError,
  clearCart,
  getCart,
  removeCartItem,
  removeCartItems,
  updateCartItem,
} from "@/lib/services/cart";

export const dynamic = "force-dynamic";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      userId: null as string | null,
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { userId, error: null };
}

export async function GET() {
  const { userId, error } = await requireUserId();
  if (error || !userId) return error!;

  try {
    const items = await getCart(userId);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("cart GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load cart" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId, error } = await requireUserId();
  if (error || !userId) return error!;

  try {
    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      color?: string;
      size?: string;
    };
    if (!body.productId) {
      return NextResponse.json(
        { success: false, error: "productId is required" },
        { status: 400 }
      );
    }
    const items = await addToCart(userId, {
      productId: body.productId,
      quantity: body.quantity ?? 1,
      color: body.color,
      size: body.size,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    if (err instanceof CartError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error("cart POST:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add to cart" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId, error } = await requireUserId();
  if (error || !userId) return error!;

  try {
    const body = (await request.json()) as {
      productId?: string;
      quantity?: number;
      color?: string;
      size?: string;
    };
    if (!body.productId || body.quantity == null) {
      return NextResponse.json(
        { success: false, error: "productId and quantity are required" },
        { status: 400 }
      );
    }
    const items = await updateCartItem(userId, {
      productId: body.productId,
      quantity: body.quantity,
      color: body.color,
      size: body.size,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    if (err instanceof CartError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error("cart PATCH:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update cart" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId, error } = await requireUserId();
  if (error || !userId) return error!;

  try {
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get("all") === "1";
    if (clearAll) {
      const items = await clearCart(userId);
      return NextResponse.json({ success: true, items });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          productId?: string;
          color?: string;
          size?: string;
          items?: Array<{ productId: string; color?: string; size?: string }>;
        }
      | null;

    if (body?.items?.length) {
      const items = await removeCartItems(userId, body.items);
      return NextResponse.json({ success: true, items });
    }

    if (!body?.productId) {
      return NextResponse.json(
        { success: false, error: "productId is required" },
        { status: 400 }
      );
    }

    const items = await removeCartItem(userId, {
      productId: body.productId,
      color: body.color,
      size: body.size,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    if (err instanceof CartError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error("cart DELETE:", err);
    return NextResponse.json(
      { success: false, error: "Failed to remove cart item" },
      { status: 500 }
    );
  }
}
