import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { findAdminOrders } from "@/lib/services/orders";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const result = await findAdminOrders({
      search: searchParams.get("search") ?? undefined,
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 8),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("admin orders GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
