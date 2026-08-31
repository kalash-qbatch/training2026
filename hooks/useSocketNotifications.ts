"use client";

import { useEffect, useRef } from "react";

import type { Socket } from "socket.io-client";

import { fetchNotifications } from "@/lib/api/notifications";
import { NOTIFICATION_PAGE_SIZE, NOTIFICATION_POLL_INTERVAL_MS } from "@/lib/constants";
import { disconnectSocketClient, getSocketClient, isSocketEnabled } from "@/lib/socket/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import type { AppNotification } from "@/types";

interface UseSocketNotificationsProps {
  onNewNotification?: (notification: AppNotification) => void;
  onUnreadCountChange?: (count: number) => void;
  onSync?: (notifications: AppNotification[], unreadCount: number) => void;
}

export function useSocketNotifications({
  onNewNotification,
  onUnreadCountChange,
  onSync,
}: UseSocketNotificationsProps = {}) {
  const user = useAuthStore((s) => s.user);
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
    if (!isAuthenticated || !user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      disconnectSocketClient();
      return;
    }

    let isSubscribed = true;

    async function syncOnce() {
      try {
        const data = await fetchNotifications({
          page: 1,
          pageSize: NOTIFICATION_PAGE_SIZE,
        });

        if (!isSubscribed) return;

        onCountRef.current?.(data.unreadCount);
        onSyncRef.current?.(data.notifications, data.unreadCount);
      } catch {
        // ignore background sync errors
      }
    }

    // Deployed / Production: Poll every 10 seconds
    if (!isSocketEnabled()) {
      void syncOnce();
      const interval = setInterval(() => {
        void syncOnce();
      }, NOTIFICATION_POLL_INTERVAL_MS);

      return () => {
        isSubscribed = false;
        clearInterval(interval);
      };
    }

    // Local: Connect via Socket.IO
    const socket = getSocketClient(user.id);
    if (!socket) {
      void syncOnce();
      const interval = setInterval(() => {
        void syncOnce();
      }, NOTIFICATION_POLL_INTERVAL_MS);

      return () => {
        isSubscribed = false;
        clearInterval(interval);
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
      socket.emit("join-user-room", user.id);
      void syncOnce();
    };

    socket.on("connect", handleConnect);
    socket.on("notification:new", handleNew);
    socket.on("notification:unread-count", handleUnreadCount);

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      isSubscribed = false;
      socket.off("connect", handleConnect);
      socket.off("notification:new", handleNew);
      socket.off("notification:unread-count", handleUnreadCount);
      socket.disconnect();
      socketRef.current = null;
      disconnectSocketClient();
    };
  }, [isAuthenticated, user?.id]);
}
