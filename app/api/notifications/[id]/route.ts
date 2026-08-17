import { NextResponse } from "next/server";
import { markOneNotificationRead } from "@/lib/controllers/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const result = await markOneNotificationRead(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("notification PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
