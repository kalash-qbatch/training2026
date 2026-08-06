import { NextResponse } from "next/server";
import { findProducts, type ProductSort } from "@/lib/services/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const sort = (searchParams.get("sort") as ProductSort | null) ?? "name-asc";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(
      searchParams.get("pageSize") || searchParams.get("limit") || 8
    );

    const result = await findProducts({ search, sort, page, pageSize });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("products GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}
