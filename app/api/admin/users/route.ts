import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listUsersForAdmin } from "@/lib/services/orders";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const users = await listUsersForAdmin();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("admin users GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load users" },
      { status: 500 }
    );
  }
}
