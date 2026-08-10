import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markNotificationRead } from "@/lib/services/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: Ctx) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    await markNotificationRead(userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("notification PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
