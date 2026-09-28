import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  addToCart,
  ChatCartError,
  getCartSummary,
  removeFromCart,
} from "@/lib/chatbot/tools/cart-service";

export const dynamic = "force-dynamic";

const DirectAddToCartSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1).default(1),
  variant: z.string().optional(),
  sessionId: z.string().optional(),
});

const DirectRemoveFromCartSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  variant: z.string().optional(),
  sessionId: z.string().optional(),
});

async function resolveSessionId(request: Request, bodySessionId?: string): Promise<string> {
  if (bodySessionId) return bodySessionId;
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const headerSession = request.headers.get("x-session-id");
  if (headerSession) return headerSession;
  return "guest_session";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const querySession = url.searchParams.get("sessionId");
    const sessionId = await resolveSessionId(request, querySession || undefined);
    const cart = getCartSummary(sessionId);

    return NextResponse.json({ success: true, cart });
  } catch (err: unknown) {
    console.error("[API:StoreAssistantCart:GET]", err);
    return NextResponse.json({ success: false, error: "Failed to retrieve cart" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = DirectAddToCartSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { productId, quantity, variant, sessionId: bodySessionId } = parsed.data;
    const sessionId = await resolveSessionId(request, bodySessionId);

    const result = await addToCart(sessionId, productId, quantity, variant);

    return NextResponse.json({
      success: true,
      message: `Added ${result.added.name} to cart.`,
      added: result.added,
      cart: result.cart,
    });
  } catch (err: unknown) {
    if (err instanceof ChatCartError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }

    console.error("[API:StoreAssistantCart:POST]", err);
    const msg = err instanceof Error ? err.message : "Failed to add to cart";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const json = await request.json();
    const parsed = DirectRemoveFromCartSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request data" }, { status: 400 });
    }

    const { productId, variant, sessionId: bodySessionId } = parsed.data;
    const sessionId = await resolveSessionId(request, bodySessionId);

    const result = await removeFromCart(sessionId, productId, variant);

    return NextResponse.json({
      success: true,
      removed: result.removed,
      cart: result.cart,
    });
  } catch (err: unknown) {
    console.error("[API:StoreAssistantCart:DELETE]", err);
    return NextResponse.json(
      { success: false, error: "Failed to remove item from cart" },
      { status: 500 }
    );
  }
}
