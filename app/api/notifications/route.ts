import { NextResponse } from "next/server";
import {
  getNotifications,
  markNotificationsRead,
} from "@/lib/controllers/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getNotifications();
    return NextResponse.json(result.body, { status: result.status });
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
    const result = await markNotificationsRead();
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("notifications PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
