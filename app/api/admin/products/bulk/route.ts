import { NextResponse } from "next/server";

import { bulkCreateAdminProducts } from "@/lib/controllers/admin-products";

export async function POST(request: Request) {
  try {
    const result = await bulkCreateAdminProducts(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products bulk:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Bulk upload failed",
      },
      { status: 500 }
    );
  }
}
