"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Bell, CheckCircle2, Package, ShoppingBag, Truck, X, XCircle } from "lucide-react";

import { useSocketNotifications } from "@/hooks/useSocketNotifications";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { NOTIFICATION_INITIAL_PAGE, NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import type { AppNotification } from "@/lib/services/notifications";
import { cn, formatRelativeTime } from "@/lib/utils";

const getNotificationTypeConfig = (title: string, message: string) => {
  const t = title.toLowerCase();
  const m = message.toLowerCase();

  // Order Cancelled
  if (t.includes("cancel") || m.includes("cancel")) {
    return {
      Icon: XCircle,
      bgClass: "bg-[#fee2e2] text-[#ef4444] border border-[#fecaca]/50",
    };
  }

  // Order Delivered
  if (t.includes("deliver") || m.includes("deliver")) {
    return {
      Icon: CheckCircle2,
      bgClass: "bg-[#ecfdf5] text-[#059669] border border-[#d1fae5]/50",
    };
  }

  // Order Shipped / Confirmed
  if (
    t.includes("shipped") ||
    t.includes("confirm") ||
    m.includes("shipped") ||
    m.includes("confirm")
  ) {
    return {
      Icon: Truck,
      bgClass: "bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]/50",
    };
  }

  // Order in progress / Processing
  if (
    t.includes("progress") ||
    t.includes("process") ||
    m.includes("progress") ||
    m.includes("process")
  ) {
    return {
      Icon: Package,
      bgClass: "bg-[#fffbeb] text-[#d97706] border border-[#fef3c7]/50",
    };
  }

  // Order Placed / Success
  if (t.includes("placed") || t.includes("success") || m.includes("placed")) {
    return {
      Icon: ShoppingBag,
      bgClass: "bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]/50",
    };
  }

  // Fallback
  return {
    Icon: Package,
    bgClass: "bg-gray-50 text-gray-500 border border-gray-100",
  };
};

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "all">("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(NOTIFICATION_INITIAL_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, isFirstPage: boolean, withDelay = false) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        // Only apply delay when user opens popover or scrolls (not socket sync)
        if (withDelay) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (controller.signal.aborted) return;
        }

        const data = await fetchNotifications({
          page: pageNum,
          pageSize: NOTIFICATION_PAGE_SIZE,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setNotifications((prev) =>
          isFirstPage ? data.notifications : [...prev, ...data.notifications]
        );
        setUnreadCount(data.unreadCount ?? 0);
        setTotalPages(data.totalPages);
        setPage(pageNum);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        if (isFirstPage) {
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  // User-triggered load: with delay for skeleton visibility
  const loadInitial = useCallback(() => {
    setPage(1);
    void fetchPage(1, true, true);
  }, [fetchPage]);

  // Initial load on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPage(1, true, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  // Real-time socket subscription (no background polling)
  useSocketNotifications({
    onNewNotification: (newNotif) => {
      setNotifications((prev) => {
        // Prevent duplicates
        if (prev.some((item) => item.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((c) => c + 1);
    },
    onUnreadCountChange: (count) => {
      setUnreadCount(count);
    },
    onSync: (latestNotifications, count) => {
      setUnreadCount(count);
      setNotifications((prev) => {
        if (!prev.length) return latestNotifications;
        const incomingIds = new Set(latestNotifications.map((n) => n.id));
        const older = prev.filter((n) => !incomingIds.has(n.id));
        return [...latestNotifications, ...older];
      });
    },
  });

  useEffect(() => {
    if (!open) return;
    const startId = window.setTimeout(loadInitial, 0);

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(startId);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loadInitial]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (
        scrollHeight - scrollTop - clientHeight < 60 &&
        !loading &&
        !loadingMore &&
        page < totalPages
      ) {
        void fetchPage(page + 1, false, true);
      }
    },
    [loading, loadingMore, page, totalPages, fetchPage]
  );

  async function onMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  async function onSelect(n: AppNotification) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setNotifications((prev) =>
          prev.map((row) => (row.id === n.id ? { ...row, read: true } : row))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
  }

  const filteredNotifications =
    activeTab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        className="relative p-1 text-neutral-text hover:text-brand-500 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5 sm:h-5.5 sm:w-5.5" strokeWidth={1.5} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Mobile backdrop */}
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-label="Notifications"
            className={cn(
              "z-50 overflow-hidden border border-[#e5e7eb] bg-white shadow-xl animate-fade-in-up origin-top-right",
              // Mobile: bottom sheet–style panel
              "fixed inset-x-3 top-15 max-h-[min(70dvh,32rem)] rounded-2xl",
              // Desktop: anchored dropdown
              "sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-100 sm:max-h-120 sm:rounded-2xl"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3.5">
              <p className="text-[15px] font-bold text-neutral-900">Notifications</p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void onMarkAllRead()}
                    className="whitespace-nowrap text-[12px] font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                  >
                    Mark all as read
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-neutral-muted hover:bg-[#f3f4f6] hover:text-neutral-900 sm:hidden"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#e5e7eb] bg-white">
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={cn(
                  "flex-1 py-3 text-center text-sm font-semibold transition-all relative",
                  activeTab === "unread" ? "text-brand-500" : "text-gray-400 hover:text-gray-600"
                )}
              >
                Unread
                {activeTab === "unread" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "flex-1 py-3 text-center text-sm font-semibold transition-all relative",
                  activeTab === "all" ? "text-brand-500" : "text-gray-400 hover:text-gray-600"
                )}
              >
                All
                {activeTab === "all" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
                )}
              </button>
            </div>

            {/* Content Area */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="max-h-[calc(min(70dvh,32rem)-6.75rem)] overflow-y-auto overscroll-contain sm:max-h-90"
            >
              {loading && !notifications.length ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-[#f3f4f6]" />
                  ))}
                </div>
              ) : !filteredNotifications.length ? (
                <p className="px-4 py-12 text-center text-[13px] font-medium text-neutral-muted">
                  {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredNotifications.map((n) => {
                    const { Icon, bgClass } = getNotificationTypeConfig(n.title, n.message);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void onSelect(n)}
                          className={cn(
                            "flex w-full items-start gap-3.5 px-4 py-4 text-left transition-colors duration-150",
                            !n.read ? "bg-slate-50/60" : "bg-white hover:bg-slate-50/40"
                          )}
                        >
                          {/* Circular Icon Container */}
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105",
                              bgClass
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                          </div>

                          {/* Content Column */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={cn(
                                  "text-[13.5px] leading-snug tracking-tight wrap-break-word",
                                  !n.read
                                    ? "text-gray-900 font-semibold"
                                    : "text-gray-800 font-medium"
                                )}
                              >
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                              )}
                            </div>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500 wrap-break-word font-normal">
                              {n.message}
                            </p>
                            <p className="mt-1.5 text-[11px] font-semibold text-gray-400">
                              {formatRelativeTime(n.createdAt)}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {loadingMore ? (
                    <li className="p-3 text-center">
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
