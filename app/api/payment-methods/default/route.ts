import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { setDefaultCustomerPaymentMethod } from "@/lib/services/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { paymentMethodId } = body as { paymentMethodId: string };
    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "Payment method ID required" },
        { status: 400 }
      );
    }
    await setDefaultCustomerPaymentMethod(session.user.id, paymentMethodId);
    return NextResponse.json({ success: true, message: "Default payment method updated" });
  } catch (err) {
    console.error("set default PM error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to set default payment method" },
      { status: 500 }
    );
  }
}
