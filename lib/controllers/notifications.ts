import { NOTIFICATION_INITIAL_PAGE, NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import { requireUser } from "@/lib/controllers/http";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/services/notifications";

export async function getNotifications(req?: Request) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  let page = NOTIFICATION_INITIAL_PAGE;
  let pageSize = NOTIFICATION_PAGE_SIZE;

  if (req) {
    const { searchParams } = new URL(req.url);
    const p = parseInt(searchParams.get("page") ?? String(NOTIFICATION_INITIAL_PAGE), 10);
    const ps = parseInt(searchParams.get("pageSize") ?? String(NOTIFICATION_PAGE_SIZE), 10);
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
