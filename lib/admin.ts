import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      error: NextResponse.json(
        { success: false, error: "Forbidden — admin only" },
        { status: 403 }
      ),
    };
  }
  return { session, error: null };
}
