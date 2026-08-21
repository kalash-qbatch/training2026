"use client";

import { useEffect, useRef } from "react";

import type { Socket } from "socket.io-client";

import { getSocketClient } from "@/lib/socket/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import type { AppNotification } from "@/types";

interface UseSocketNotificationsProps {
  onNewNotification?: (notification: AppNotification) => void;
  onUnreadCountChange?: (count: number) => void;
}

export function useSocketNotifications({
  onNewNotification,
  onUnreadCountChange,
}: UseSocketNotificationsProps = {}) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<Socket | null>(null);

  const onNewNotifRef = useRef(onNewNotification);
  const onCountRef = useRef(onUnreadCountChange);

  useEffect(() => {
    onNewNotifRef.current = onNewNotification;
    onCountRef.current = onUnreadCountChange;
  });

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = getSocketClient(user.id);
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-user-room", user.id);

    function handleNew(notification: AppNotification) {
      onNewNotifRef.current?.(notification);
    }

    function handleUnreadCount(payload: { unreadCount: number }) {
      onCountRef.current?.(payload.unreadCount);
    }

    socket.on("notification:new", handleNew);
    socket.on("notification:unread-count", handleUnreadCount);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:unread-count", handleUnreadCount);
    };
  }, [isAuthenticated, user?.id]);
}
