import type { AppNotification } from "@/lib/services/notifications";

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json()) as T & { error?: string };
}

export async function fetchNotifications() {
  const res = await fetch("/api/notifications", { cache: "no-store" });
  const data = await parseJson<{
    success: boolean;
    notifications: AppNotification[];
    unreadCount: number;
  }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load notifications");
  }
  return {
    notifications: data.notifications,
    unreadCount: data.unreadCount,
  };
}

export async function markAllNotificationsRead() {
  const res = await fetch("/api/notifications", { method: "PATCH" });
  const data = await parseJson<{ success: boolean }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to mark notifications read");
  }
}

export async function markNotificationRead(id: string) {
  const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  const data = await parseJson<{ success: boolean }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to mark notification read");
  }
}
