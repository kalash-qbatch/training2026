import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/services/notifications";
import { requireUser } from "@/lib/controllers/http";

export async function getNotifications(req?: Request) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  let page = 1;
  let pageSize = 8;

  if (req) {
    const { searchParams } = new URL(req.url);
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    const ps = parseInt(searchParams.get("pageSize") ?? "8", 10);
    if (!Number.isNaN(p) && p > 0) page = p;
    if (!Number.isNaN(ps) && ps > 0) pageSize = ps;
  }

  const result = await listNotifications(userId, page, pageSize);
  return { status: 200, body: { success: true, ...result } };
}

export async function markNotificationsRead() {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  await markAllNotificationsRead(userId);
  return { status: 200, body: { success: true } };
}

export async function markOneNotificationRead(id: string) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  await markNotificationRead(userId, id);
  return { status: 200, body: { success: true } };
}
