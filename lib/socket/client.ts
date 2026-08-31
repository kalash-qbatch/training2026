"use client";

import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

let socket: Socket | null = null;

/**
 * WebSockets are enabled in development by default.
 * Set NEXT_PUBLIC_SOCKET_ENABLED=false to disable, or true to force-enable in production.
 */
export function isSocketEnabled(): boolean {
  if (typeof window === "undefined") return false;

  const envFlag = process.env.NEXT_PUBLIC_SOCKET_ENABLED;
  if (envFlag === "false" || envFlag === "0") return false;
  if (envFlag === "true" || envFlag === "1") return true;

  return process.env.NODE_ENV === "development";
}

export function getSocketClient(userId?: string): Socket | null {
  if (!isSocketEnabled()) {
    return null;
  }

  if (!socket) {
    socket = io({
      path: "/api/socket/io",
      addTrailingSlash: false,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
      auth: userId ? { userId } : undefined,
    });
  } else if (userId) {
    socket.auth = { userId };
  }

  return socket;
}

export function disconnectSocketClient() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
