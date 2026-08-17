import { NextResponse } from "next/server";
import { forgotPassword } from "@/lib/controllers/forgot-password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await forgotPassword(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process forgot password request" },
      { status: 500 }
    );
  }
}
