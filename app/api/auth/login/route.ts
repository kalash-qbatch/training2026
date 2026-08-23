import { NextResponse } from "next/server";

import { register } from "@/lib/controllers/register";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result = await register(body);

    return NextResponse.json(result.body, {
      status: result.status,
    });
  } catch (error) {
    console.error("Register error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed",
      },
      {
        status: 500,
      }
    );
  }
}
