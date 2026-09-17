"use client";

import { useEffect, useRef } from "react";

import type { Socket } from "socket.io-client";

import { fetchNotifications } from "@/lib/api/notifications";
import { NOTIFICATION_PAGE_SIZE, NOTIFICATION_POLL_INTERVAL_MS } from "@/lib/constants";
import { getSocketClient, isSocketEnabled } from "@/lib/socket/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import type { AppNotification } from "@/types";

interface UseSocketNotificationsProps {
  onNewNotification?: (notification: AppNotification) => void;
  onUnreadCountChange?: (count: number) => void;
  onSync?: (notifications: AppNotification[], unreadCount: number) => void;
}

/** Skip back-to-back syncs from remount / reconnect storms. */
const SYNC_DEDUP_MS = 5_000;
let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;
let subscriberCount = 0;

async function syncNotificationsOnce(
  onCount?: (count: number) => void,
  onSync?: (notifications: AppNotification[], unreadCount: number) => void
) {
  const now = Date.now();
  if (syncInFlight) return syncInFlight;
  if (now - lastSyncAt < SYNC_DEDUP_MS) return;

  lastSyncAt = now;
  syncInFlight = (async () => {
    try {
      const data = await fetchNotifications({
        page: 1,
        pageSize: NOTIFICATION_PAGE_SIZE,
      });
      onCount?.(data.unreadCount);
      onSync?.(data.notifications, data.unreadCount);
    } catch {
      // ignore background sync errors
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

function startVisiblePoll(runSync: () => void) {
  runSync();
  const interval = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    runSync();
  }, NOTIFICATION_POLL_INTERVAL_MS);
  return () => clearInterval(interval);
}

export function useSocketNotifications({
  onNewNotification,
  onUnreadCountChange,
  onSync,
}: UseSocketNotificationsProps = {}) {
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<Socket | null>(null);

  const onNewNotifRef = useRef(onNewNotification);
  const onCountRef = useRef(onUnreadCountChange);
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onNewNotifRef.current = onNewNotification;
    onCountRef.current = onUnreadCountChange;
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }

    let isSubscribed = true;
    subscriberCount += 1;

    const runSync = () => {
      if (!isSubscribed) return;
      void syncNotificationsOnce(
        (count) => onCountRef.current?.(count),
        (notifications, count) => onSyncRef.current?.(notifications, count)
      );
    };

    // Deployed / sockets disabled: light polling (deduped, only while tab visible)
    if (!isSocketEnabled()) {
      const stopPoll = startVisiblePoll(runSync);
      return () => {
        isSubscribed = false;
        subscriberCount = Math.max(0, subscriberCount - 1);
        stopPoll();
      };
    }

    const socket = getSocketClient(userId);
    if (!socket) {
      const stopPoll = startVisiblePoll(runSync);
      return () => {
        isSubscribed = false;
        subscriberCount = Math.max(0, subscriberCount - 1);
        stopPoll();
      };
    }

    socketRef.current = socket;

    const handleNew = (notification: AppNotification) => {
      onNewNotifRef.current?.(notification);
    };

    const handleUnreadCount = (payload: { unreadCount: number }) => {
      onCountRef.current?.(payload.unreadCount);
    };

    const handleConnect = () => {
      socket.emit("join-user-room", userId);
      runSync();
    };

    socket.on("connect", handleConnect);
    socket.on("notification:new", handleNew);
    socket.on("notification:unread-count", handleUnreadCount);

    // One mount sync; connect handler covers first connect + reconnects (deduped).
    if (socket.connected) {
      handleConnect();
    } else {
      runSync();
      socket.connect();
    }

    return () => {
      isSubscribed = false;
      subscriberCount = Math.max(0, subscriberCount - 1);
      socket.off("connect", handleConnect);
      socket.off("notification:new", handleNew);
      socket.off("notification:unread-count", handleUnreadCount);
      socketRef.current = null;
      // Keep the shared socket alive while other subscribers (or remounts) may reuse it.
      // Only leave the room; do not disconnect/destroy the singleton.
      if (subscriberCount === 0 && socket.connected) {
        socket.emit("leave-user-room", userId);
      }
    };
  }, [isAuthenticated, userId]);
}
