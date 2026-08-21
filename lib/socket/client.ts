"use client";

import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

let socket: Socket | null = null;

export function getSocketClient(userId?: string): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socket/io",
      addTrailingSlash: false,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: userId ? { userId } : undefined,
    });
  } else if (userId && socket.auth) {
    socket.auth = { userId };
  }

  return socket;
}
