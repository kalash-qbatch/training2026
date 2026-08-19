import type { AppNotification } from "@/lib/services/notifications";

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json()) as T & { error?: string };
}

export async function fetchNotifications(opts?: {
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));

  const qs = params.toString();
  const url = qs ? `/api/notifications?${qs}` : "/api/notifications";

  const res = await fetch(url, {
    cache: "no-store",
    signal: opts?.signal,
  });
  const data = await parseJson<{
    success: boolean;
    notifications: AppNotification[];
    unreadCount: number;
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  }>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load notifications");
  }
  return {
    notifications: data.notifications,
    unreadCount: data.unreadCount,
    total: data.total ?? data.notifications.length,
    page: data.page ?? opts?.page ?? 1,
    pageSize: data.pageSize ?? opts?.pageSize ?? 8,
    totalPages: data.totalPages ?? 1,
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
