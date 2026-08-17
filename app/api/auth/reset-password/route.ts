import { NextResponse } from "next/server";
import {
  resetPassword,
  validateResetToken,
} from "@/lib/controllers/reset-password";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    const result = await validateResetToken(token);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("reset-password validate error:", error);
    return NextResponse.json(
      { success: false, valid: false, error: "Failed to validate reset link" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await resetPassword(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
