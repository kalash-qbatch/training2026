import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/services/notifications";
import { requireUser } from "@/lib/controllers/http";

export async function getNotifications() {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const result = await listNotifications(userId);
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
