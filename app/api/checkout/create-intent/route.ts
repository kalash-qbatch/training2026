import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { TAX_RATE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { createPaymentIntentForCart } from "@/lib/services/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { items, paymentMethodId, savePaymentMethod } = body as {
      items: Array<{ productId: string; specificationId?: string; quantity: number }>;
      paymentMethodId?: string;
      savePaymentMethod?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    // Calculate total from DB prices (never trust client-side totals)
    let totalCents = 0;
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        return NextResponse.json(
          { success: false, error: `Product not found or unavailable` },
          { status: 400 }
        );
      }
      const price = Number(product.price);
      totalCents += price * item.quantity;
    }

    const tax = totalCents * TAX_RATE;
    const grandTotal = totalCents + tax;
    const amountCents = Math.round(grandTotal * 100); // Stripe uses cents

    const { clientSecret, paymentIntentId } = await createPaymentIntentForCart(
      userId,
      amountCents,
      paymentMethodId,
      savePaymentMethod
    );

    return NextResponse.json({
      success: true,
      clientSecret,
      paymentIntentId,
      amount: grandTotal,
    });
  } catch (err) {
    console.error("create-intent error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
