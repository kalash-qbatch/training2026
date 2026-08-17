import { NextResponse } from "next/server";
import { register } from "@/lib/controllers/register";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await register(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed" },
      { status: 500 }
    );
  }
}
