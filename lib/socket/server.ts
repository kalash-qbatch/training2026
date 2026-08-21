import type { Server as SocketIOServer } from "socket.io";

import type { AppNotification } from "@/types";

declare global {
  var __io: SocketIOServer | undefined;
}

export function setSocketServer(io: SocketIOServer) {
  global.__io = io;
}

export function getSocketServer(): SocketIOServer | undefined {
  return global.__io;
}

/**
 * Emit a new notification directly to a specific user's private room.
 */
export function emitNotificationToUser(userId: string, notification: AppNotification) {
  const io = getSocketServer();
  if (!io) return;
  io.to(`user:${userId}`).emit("notification:new", notification);
}

/**
 * Emit updated unread count to a specific user's room.
 */
export function emitUnreadCountToUser(userId: string, unreadCount: number) {
  const io = getSocketServer();
  if (!io) return;
  io.to(`user:${userId}`).emit("notification:unread-count", { unreadCount });
}
