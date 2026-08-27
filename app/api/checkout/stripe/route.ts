import { NextResponse } from "next/server";

/** Stripe checkout is disabled for now. */
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Stripe checkout is not enabled" },
    { status: 404 }
  );
}
