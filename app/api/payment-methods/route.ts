import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { attachPaymentMethodToCustomer, listCustomerPaymentMethods } from "@/lib/services/stripe";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const paymentMethods = await listCustomerPaymentMethods(session.user.id);
    return NextResponse.json({ success: true, paymentMethods });
  } catch (err) {
    console.error("list payment methods error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to list payment methods" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await request.json();
    const { paymentMethodId } = body as { paymentMethodId: string };

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "Payment method ID required" },
        { status: 400 }
      );
    }

    await attachPaymentMethodToCustomer(userId, paymentMethodId);
    return NextResponse.json({ success: true, message: "Payment method saved" });
  } catch (err) {
    console.error("attach payment method error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save payment method" },
      { status: 500 }
    );
  }
}
