import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createCustomerSetupIntent } from "@/lib/services/stripe";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const clientSecret = await createCustomerSetupIntent(session.user.id);
    return NextResponse.json({ success: true, clientSecret });
  } catch (err) {
    console.error("setup intent error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
