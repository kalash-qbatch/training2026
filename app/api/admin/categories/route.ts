import { NextResponse } from "next/server";

import { createAdminCategory, listAdminCategories } from "@/lib/controllers/admin-categories";

export async function GET() {
  try {
    const result = await listAdminCategories();
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin categories GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createAdminCategory(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin categories POST:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create category",
      },
      { status: 500 }
    );
  }
}
