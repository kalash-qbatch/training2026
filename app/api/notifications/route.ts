import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listNotifications,
  markAllNotificationsRead,
} from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await listNotifications(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("notifications GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await markAllNotificationsRead(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("notifications PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
