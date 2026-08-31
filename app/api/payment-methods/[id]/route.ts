import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteCustomerPaymentMethod } from "@/lib/services/stripe";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await deleteCustomerPaymentMethod(session.user.id, id);
    return NextResponse.json({ success: true, message: "Payment method removed" });
  } catch (err) {
    console.error("delete payment method error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
