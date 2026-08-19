import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
};

type TxClient = Prisma.TransactionClient;

function shortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

export function statusNotificationCopy(status: OrderStatus): {
  title: string;
  message: string;
} {
  switch (status) {
    case "SHIPPED":
      return {
        title: "Order confirmed",
        message: "Your order is confirmed.",
      };
    case "DELIVERED":
      return {
        title: "Order delivered",
        message: "Your order has been delivered.",
      };
    case "CANCELLED":
      return {
        title: "Order cancelled",
        message: "Your order has been cancelled.",
      };
    case "PROCESSING":
      return {
        title: "Order in progress",
        message: "Your order is in progress.",
      };
    default:
      return {
        title: "Order updated",
        message: "Your order status has been updated.",
      };
  }
}

export async function createNotification(
  tx: TxClient | typeof prisma,
  data: {
    userId: string;
    title: string;
    message: string;
    orderId?: string;
  }
) {
  return tx.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      orderId: data.orderId,
    },
  });
}

export async function notifyOrderPlaced(
  tx: TxClient | typeof prisma,
  userId: string,
  orderId: string
) {
  const ref = shortOrderId(orderId);
  return await createNotification(tx, {
    userId,
    title: "Order placed",
    message: `Your order #${ref} has been placed successfully.`,
    orderId,
  });
}

export async function notifyOrderStatusChange(
  tx: TxClient | typeof prisma,
  userId: string,
  orderId: string,
  status: OrderStatus
) {
  const copy = statusNotificationCopy(status);
  const ref = shortOrderId(orderId);
  return createNotification(tx, {
    userId,
    title: copy.title,
    message: `${copy.message} (Order #${ref})`,
    orderId,
  });
}

export async function listNotifications(
  userId: string,
  page = 1,
  pageSize = 8
) {
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    notifications: rows.map(
      (n): AppNotification => ({
        id: n.id,
        title: n.title,
        message: n.message,
        orderId: n.orderId ?? undefined,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })
    ),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    unreadCount,
  };
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
