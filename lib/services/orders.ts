import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

import { cartExpiryCutoff } from "@/lib/cart-expiration";
import { TAX_RATE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { buildInvoiceEmailPayload, selectInvoiceProductImage } from "@/lib/email-payloads";
import { mapOrder } from "@/lib/mappers";
import { buildOrderUniqueWhere, parseOrderRef } from "@/lib/order-id";
import { removeCartItems, syncOrderItemsToCart } from "@/lib/services/cart";
import { notifyOrderPlaced, notifyOrderStatusChange } from "@/lib/services/notifications";
import type { AdminOrderFilters, Order, OrderItem, PlaceOrderItemInput } from "@/types";

export type { AdminOrderFilters, PlaceOrderItemInput };
export type { PaymentStatus };

export type ShippingInfo = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
};

const orderItemsInclude = {
  include: { product: { include: { images: true } } },
} as const;

const orderInclude = {
  user: { select: { fullName: true, name: true, email: true } },
  items: orderItemsInclude,
} as const;

// Error handling component with status code as well
export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "OrderError";
  }

  static is(error: unknown): error is OrderError {
    return error instanceof OrderError || (error instanceof Error && error.name === "OrderError");
  }
}

export async function createOrder(
  userId: string,
  items: PlaceOrderItemInput[],
  opts?: {
    paymentMethod?: "CARD" | "COD";
    paymentStatus?: PaymentStatus;
    stripePaymentIntentId?: string;
    stripeClientSecret?: string;
    shipping?: ShippingInfo;
    orderStatus?: OrderStatus;
  }
) {
  if (!items.length) {
    throw new OrderError("Cart is empty");
  }

  const created = await prisma.$transaction(
    async (tx) => {
      const lineData: Array<{
        productId: string;
        specificationId?: string;
        title: string;
        imageUrl: string;
        quantity: number;
        price: number;
        color?: string;
        size?: string;
      }> = [];

      for (const item of items) {
        if (item.quantity < 1) {
          throw new OrderError("Invalid quantity");
        }

        // Claim the live cart line atomically; rollback restores it if checkout fails.
        const claimed = await tx.cartItem.deleteMany({
          where: {
            userId,
            productId: item.productId,
            specificationId: item.specificationId?.trim() || null,
            quantity: { gte: item.quantity },
            createdAt: { gt: cartExpiryCutoff() },
          },
        });
        if (claimed.count === 0) {
          throw new OrderError(
            "Your cart has expired or changed. Please add the items again.",
            409
          );
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: {
            specifications: true,
            images: { orderBy: { sortOrder: "asc" } },
          },
        });
        if (!product) {
          throw new OrderError("Product not found", 404);
        }
        if (!product.isActive) {
          throw new OrderError(`"${product.title}" is no longer available.`);
        }

        const hasSpecs = product.specifications.length > 0;
        let color = item.color?.trim() || undefined;
        let size = item.size?.trim() || undefined;
        let specificationId: string | undefined = item.specificationId?.trim() || undefined;

        if (hasSpecs) {
          let spec = specificationId
            ? await tx.specification.findUnique({
                where: { id: specificationId },
              })
            : null;

          // Fallback lookup if specificationId wasn't passed directly
          if (!spec && (color || size)) {
            spec = await tx.specification.findFirst({
              where: {
                productId: product.id,
                color: { equals: color ?? "", mode: "insensitive" },
                size: { equals: size ?? "", mode: "insensitive" },
              },
            });
          }

          if (!spec) {
            throw new OrderError(`A valid variant selection is required for "${product.title}".`);
          }

          specificationId = spec.id;
          color = spec.color;
          size = spec.size;

          // Atomic decrement — fails if concurrent order already consumed stock
          const decremented = await tx.specification.updateMany({
            where: { id: spec.id, qty: { gte: item.quantity } },
            data: { qty: { decrement: item.quantity } },
          });

          if (decremented.count !== 1) {
            throw new OrderError(`Not enough stock for "${product.title}". Only ${spec.qty} left.`);
          }

          const agg = await tx.specification.aggregate({
            where: { productId: product.id },
            _sum: { qty: true },
          });
          await tx.product.update({
            where: { id: product.id },
            data: { stock: agg._sum.qty ?? 0 },
          });
        } else {
          const decremented = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (decremented.count !== 1) {
            throw new OrderError(
              `Not enough stock for "${product.title}". Only ${product.stock} left.`
            );
          }
          specificationId = undefined;
          color = undefined;
          size = undefined;
        }

        const imageUrl = selectInvoiceProductImage(product, color);

        lineData.push({
          productId: product.id,
          specificationId,
          title: product.title,
          imageUrl,
          quantity: item.quantity,
          price: Number(product.price),
          color,
          size,
        });
      }

      const subTotal = lineData.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const tax = Number((subTotal * TAX_RATE).toFixed(2));
      const total = Number((subTotal + tax).toFixed(2));

      const paymentMethod = opts?.paymentMethod ?? "CARD";
      const paymentStatus = opts?.paymentStatus ?? "PENDING";
      // Orders stay PENDING until payment is settled or an admin approves them.
      const orderStatus = opts?.orderStatus ?? "PENDING";

      const order = await tx.order.create({
        data: {
          userId,
          status: orderStatus,
          paymentMethod,
          paymentStatus,
          stripePaymentIntentId: opts?.stripePaymentIntentId ?? null,
          stripeClientSecret: opts?.stripeClientSecret ?? null,
          shippingFullName: opts?.shipping?.fullName ?? null,
          shippingEmail: opts?.shipping?.email ?? null,
          shippingPhone: opts?.shipping?.phone ?? null,
          shippingAddress: opts?.shipping?.address ?? null,
          shippingCity: opts?.shipping?.city ?? null,
          shippingPostalCode: opts?.shipping?.postalCode ?? null,
          subTotal,
          tax,
          total,
          items: {
            create: lineData.map((line) => ({
              productId: line.productId,
              specificationId: line.specificationId,
              quantity: line.quantity,
              price: line.price,
              color: line.color,
              size: line.size,
            })),
          },
        },
        include: {
          user: { select: { fullName: true, name: true, email: true } },
          items: orderItemsInclude,
        },
      });

      await notifyOrderPlaced(tx, userId, order.id);

      for (const line of lineData) {
        await tx.cartItem.deleteMany({
          where: {
            userId,
            productId: line.productId,
            specificationId: line.specificationId ?? null,
          },
        });
      }

      return {
        mapped: mapOrder(order),
        mail: {
          to: order.shippingEmail || order.user?.email || null,
          name: order.shippingFullName || order.user?.fullName || order.user?.name || "Customer",
          orderId: order.id,
          subTotal: Number(order.subTotal),
          tax: Number(order.tax),
          total: Number(order.total),
          paymentMethod,
          paymentStatus,
          orderStatus,
          items: lineData.map((line) => ({
            title: line.title,
            imageUrl: line.imageUrl,
            quantity: line.quantity,
            unitPrice: line.price,
            color: line.color,
            size: line.size,
          })),
          shipping: opts?.shipping,
        },
      };
    },
    { maxWait: 15_000, timeout: 30_000 }
  );

  if (created.mail.to && created.mail.paymentMethod === "COD") {
    // Card invoices wait until payment succeeds (see confirmExistingOrderPayment).
    try {
      const { enqueueEmailJob } = await import("@/lib/job-scheduler");
      await enqueueEmailJob({
        emailType: "invoice",
        to: created.mail.to,
        payload: buildInvoiceEmailPayload(created.mail),
      });
    } catch (mailErr) {
      console.error("Failed to enqueue order invoice email:", mailErr);
    }
  }

  return created.mapped;
}

export async function findOrders(
  page = 1,
  pageSize = 5,
  userId?: string
): Promise<{
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where = userId ? { userId } : {};
  const total = await prisma.order.count({ where });
  const rows = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    orders: rows.map(mapOrder),
    total,
    page,
    pageSize,
  };
}

/** Last delivery address the user submitted (any order with shipping filled). */
export async function findLatestShippingForUser(userId: string): Promise<ShippingInfo | null> {
  const row = await prisma.order.findFirst({
    where: {
      userId,
      shippingFullName: { not: null },
      NOT: { shippingFullName: "" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      shippingFullName: true,
      shippingEmail: true,
      shippingPhone: true,
      shippingAddress: true,
      shippingCity: true,
      shippingPostalCode: true,
    },
  });

  if (!row?.shippingFullName) return null;

  return {
    fullName: row.shippingFullName,
    email: row.shippingEmail ?? "",
    phone: row.shippingPhone ?? "",
    address: row.shippingAddress ?? "",
    city: row.shippingCity ?? "",
    postalCode: row.shippingPostalCode ?? "",
  };
}

export async function findOrderById(id: string, userId?: string): Promise<Order | null> {
  const row = await prisma.order.findFirst({
    where: buildOrderUniqueWhere(id, userId),
    include: orderInclude,
  });
  if (!row) return null;

  if (
    row.status === "DELIVERED" &&
    row.paymentStatus !== "SUCCEEDED" &&
    row.paymentStatus !== "PAID" &&
    row.paymentStatus !== "FAILED" &&
    row.paymentStatus !== "REFUNDED"
  ) {
    const updated = await prisma.order.update({
      where: { id: row.id },
      data: { paymentStatus: "SUCCEEDED", nextPaymentRetryAt: null },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: orderItemsInclude,
      },
    });
    return mapOrder(updated);
  }

  return mapOrder(row);
}

const ALLOWED_STATUS_UPDATES = new Set<OrderStatus>([
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

type TxClient = Prisma.TransactionClient;

async function syncProductStockFromSpecs(tx: TxClient, productId: string) {
  const agg = await tx.specification.aggregate({
    where: { productId },
    _sum: { qty: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { stock: agg._sum.qty ?? 0 },
  });
}

/** Put cancelled order quantities back into Specification / Product stock. */
async function restoreStockForOrderItems(
  tx: TxClient,
  items: Array<{
    productId: string;
    specificationId?: string | null;
    quantity: number;
    color: string | null;
    size: string | null;
  }>
) {
  for (const item of items) {
    if (item.specificationId) {
      await tx.specification.updateMany({
        where: { id: item.specificationId },
        data: { qty: { increment: item.quantity } },
      });
      await syncProductStockFromSpecs(tx, item.productId);
      continue;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      include: { specifications: true },
    });
    if (!product) continue;

    const color = item.color?.trim() ?? "";
    const size = item.size?.trim() ?? "";
    const hasSpecs = product.specifications.length > 0;

    if (hasSpecs && (color || size)) {
      const spec = await tx.specification.findFirst({
        where: {
          productId: product.id,
          color: { equals: color, mode: "insensitive" },
          size: { equals: size, mode: "insensitive" },
        },
      });
      if (spec) {
        await tx.specification.update({
          where: { id: spec.id },
          data: { qty: { increment: item.quantity } },
        });
        await syncProductStockFromSpecs(tx, product.id);
        continue;
      }
    }

    await tx.product.update({
      where: { id: product.id },
      data: { stock: { increment: item.quantity } },
    });
  }
}

/** Re-deduct stock when an order is un-cancelled. */
async function consumeStockForOrderItems(
  tx: TxClient,
  items: Array<{
    productId: string;
    specificationId?: string | null;
    quantity: number;
    color: string | null;
    size: string | null;
  }>
) {
  for (const item of items) {
    if (item.specificationId) {
      const decremented = await tx.specification.updateMany({
        where: { id: item.specificationId, qty: { gte: item.quantity } },
        data: { qty: { decrement: item.quantity } },
      });
      if (decremented.count !== 1) {
        throw new OrderError(`Not enough stock to reactivate order.`);
      }
      await syncProductStockFromSpecs(tx, item.productId);
      continue;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      include: { specifications: true },
    });
    if (!product) {
      throw new OrderError("Product not found for order item", 404);
    }

    const color = item.color?.trim() ?? "";
    const size = item.size?.trim() ?? "";
    const hasSpecs = product.specifications.length > 0;

    if (hasSpecs) {
      if (!color && !size) {
        throw new OrderError(
          `A variant selection is required to restore stock for "${product.title}".`
        );
      }
      const spec = await tx.specification.findFirst({
        where: {
          productId: product.id,
          color: { equals: color, mode: "insensitive" },
          size: { equals: size, mode: "insensitive" },
        },
      });
      if (!spec) {
        throw new OrderError(`Cannot reactivate order — variant missing for "${product.title}".`);
      }
      const decremented = await tx.specification.updateMany({
        where: { id: spec.id, qty: { gte: item.quantity } },
        data: { qty: { decrement: item.quantity } },
      });
      if (decremented.count !== 1) {
        throw new OrderError(
          `Not enough stock to reactivate order for "${product.title}". Only ${spec.qty} left.`
        );
      }
      await syncProductStockFromSpecs(tx, product.id);
    } else {
      const decremented = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (decremented.count !== 1) {
        throw new OrderError(`Not enough stock to reactivate order for "${product.title}".`);
      }
    }
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!ALLOWED_STATUS_UPDATES.has(status)) {
    throw new OrderError("Invalid order status");
  }

  const mapped = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            productId: true,
            specificationId: true,
            quantity: true,
            color: true,
            size: true,
          },
        },
      },
    });
    if (!existing) {
      throw new OrderError("Order not found", 404);
    }

    // Card unpaid/failed → Cancel only
    if (
      existing.paymentMethod === "CARD" &&
      existing.paymentStatus !== "SUCCEEDED" &&
      existing.paymentStatus !== "PAID" &&
      status !== "CANCELLED"
    ) {
      throw new OrderError(
        "Cannot update order status for card payments until payment is successfully completed.",
        400
      );
    }

    // Card paid → Approve/Deliver only (no Cancel)
    if (
      existing.paymentMethod === "CARD" &&
      (existing.paymentStatus === "SUCCEEDED" || existing.paymentStatus === "PAID") &&
      status === "CANCELLED"
    ) {
      throw new OrderError("Cannot cancel a card order after payment has succeeded.", 400);
    }

    const wasCancelled = existing.status === "CANCELLED";
    const willCancel = status === "CANCELLED";

    // Cancel → put items back in stock (once)
    if (willCancel && !wasCancelled) {
      await restoreStockForOrderItems(tx, existing.items);
    }

    // Un-cancel → take stock again
    if (!willCancel && wasCancelled) {
      await consumeStockForOrderItems(tx, existing.items);
    }

    const row = await tx.order.update({
      where: { id },
      data: {
        status,
        ...(status === "DELIVERED" &&
        existing.paymentStatus !== "SUCCEEDED" &&
        existing.paymentStatus !== "PAID"
          ? { paymentStatus: "SUCCEEDED" as PaymentStatus, nextPaymentRetryAt: null }
          : {}),
      },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: orderItemsInclude,
      },
    });

    await notifyOrderStatusChange(tx, existing.userId, id, status);

    return {
      order: mapOrder(row),
      mail: {
        to: row.shippingEmail || row.user?.email || null,
        name: row.shippingFullName || row.user?.fullName || row.user?.name || "Customer",
        orderId: row.id,
        total: Number(row.total).toFixed(2),
        status,
        justCancelled: willCancel && !wasCancelled,
      },
    };
  });

  if (mapped.mail.to) {
    try {
      const { enqueueEmailJob } = await import("@/lib/job-scheduler");
      if (mapped.mail.status === "SHIPPED") {
        await enqueueEmailJob({
          emailType: "order_approved",
          to: mapped.mail.to,
          payload: {
            order_id: mapped.mail.orderId,
            order_number: mapped.mail.orderId,
            name: mapped.mail.name,
            total: mapped.mail.total,
            subject: `Order ${mapped.mail.orderId} Approved — On the way!`,
          },
        });
      } else if (mapped.mail.status === "DELIVERED") {
        await enqueueEmailJob({
          emailType: "order_delivered",
          to: mapped.mail.to,
          payload: {
            order_id: mapped.mail.orderId,
            order_number: mapped.mail.orderId,
            name: mapped.mail.name,
            total: mapped.mail.total,
            subject: `Your Order ${mapped.mail.orderId} has been Delivered!`,
          },
        });
      } else if (mapped.mail.justCancelled) {
        await enqueueEmailJob({
          emailType: "order_cancelled",
          to: mapped.mail.to,
          payload: {
            order_id: mapped.mail.orderId,
            order_number: mapped.mail.orderId,
            name: mapped.mail.name,
            reason: "it was cancelled by the store",
            subject: `Order ${mapped.mail.orderId} has been Cancelled`,
          },
        });
      }
    } catch (mailErr) {
      console.error("Failed to enqueue order status email:", mailErr);
    }
  }

  return mapped.order;
}

function buildOrderWhere(opts: AdminOrderFilters): Prisma.OrderWhereInput {
  const q = opts.search?.trim();
  const ref = q ? parseOrderRef(q) : "";
  return {
    AND: [
      opts.userId ? { userId: opts.userId } : {},
      opts.status ? { status: opts.status } : {},
      opts.minAmount != null ? { total: { gte: opts.minAmount } } : {},
      opts.maxAmount != null ? { total: { lte: opts.maxAmount } } : {},
      opts.dateFrom ? { createdAt: { gte: new Date(opts.dateFrom) } } : {},
      opts.dateTo
        ? {
            createdAt: {
              lte: new Date(`${opts.dateTo}T23:59:59.999Z`),
            },
          }
        : {},
      ref ? { id: { contains: ref, mode: "insensitive" as const } } : {},
    ],
  };
}

export async function findAdminOrders(opts: AdminOrderFilters = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 8;
  const where = buildOrderWhere(opts);

  const [total, rows, aggregates, unitsAgg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.aggregate({
      where,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.orderItem.aggregate({
      where: { order: where },
      _sum: { quantity: true },
    }),
  ]);

  return {
    orders: rows.map(mapOrder),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      totalOrders: aggregates._count._all,
      totalUnits: unitsAgg._sum.quantity ?? 0,
      totalAmount: Number(aggregates._sum.total ?? 0),
    },
  };
}
export async function listUsersForAdmin() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      name: true,
    },
    orderBy: { fullName: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName || u.name || "User",
    email: u.email ?? "",
  }));
}

/**
 * Find an order by its Stripe PaymentIntent ID.
 */
export async function findOrderByPaymentIntentId(paymentIntentId: string) {
  return prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: orderItemsInclude,
    },
  });
}

/**
 * Update an order's payment status (called by webhooks / checkout confirm).
 */
export async function updateOrderPaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const current = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!current) throw new OrderError("Order not found", 404);
    if (
      paymentStatus === "PROCESSING" &&
      (current.status === "CANCELLED" ||
        ["SUCCEEDED", "PAID", "REFUNDED"].includes(current.paymentStatus))
    ) {
      return mapOrder(current);
    }
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        ...(paymentStatus === "SUCCEEDED" || paymentStatus === "PAID"
          ? { nextPaymentRetryAt: null }
          : {}),
      },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    });

    return mapOrder(order);
  });
}

/**
 * Attach a Stripe PaymentIntent to an existing order (retry flow).
 */
export async function attachPaymentIntentToOrder(
  orderId: string,
  userId: string,
  stripePaymentIntentId: string,
  stripeClientSecret: string
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });
  if (!order) {
    throw new OrderError("Order not found", 404);
  }
  if (order.status === "CANCELLED") {
    throw new OrderError("This order has been cancelled.", 400);
  }
  if (order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID") {
    throw new OrderError("This order has already been paid.", 400);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      stripePaymentIntentId,
      stripeClientSecret,
      paymentStatus: "PENDING",
      paymentMethod: "CARD",
      nextPaymentRetryAt: null,
    },
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: orderItemsInclude,
    },
  });

  return mapOrder(updated);
}

/**
 * Switch a failed card order to COD (retry with different payment method).
 */
export async function switchOrderToCod(orderId: string, userId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new OrderError("Order not found", 404);
    }
    if (order.status === "CANCELLED") {
      throw new OrderError("This order has been cancelled.", 400);
    }
    if (order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID") {
      throw new OrderError("This order has already been paid.", 400);
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        stripePaymentIntentId: null,
        stripeClientSecret: null,
        nextPaymentRetryAt: null,
        status: "PENDING",
      },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: orderItemsInclude,
      },
    });
  });

  await removeCartItems(
    userId,
    updated.items.map((item) => ({
      productId: item.productId,
      specificationId: item.specificationId,
    }))
  );

  const recipientEmail = updated.shippingEmail || updated.user?.email;
  const recipientName =
    updated.shippingFullName || updated.user?.fullName || updated.user?.name || "Customer";
  if (recipientEmail) {
    try {
      const { enqueueEmailJob } = await import("@/lib/job-scheduler");
      await enqueueEmailJob({
        emailType: "invoice",
        to: recipientEmail,
        payload: buildInvoiceEmailPayload({
          orderId: updated.id,
          name: recipientName,
          subTotal: Number(updated.subTotal),
          tax: Number(updated.tax),
          total: Number(updated.total),
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          orderStatus: "PENDING",
          items: updated.items.map((item) => ({
            title: item.product.title,
            imageUrl: selectInvoiceProductImage(item.product, item.color ?? undefined),
            quantity: item.quantity,
            unitPrice: Number(item.price),
            color: item.color ?? undefined,
            size: item.size ?? undefined,
          })),
          shipping: {
            fullName: updated.shippingFullName || recipientName,
            email: recipientEmail,
            phone: updated.shippingPhone || "",
            address: updated.shippingAddress || "",
            city: updated.shippingCity || "",
            postalCode: updated.shippingPostalCode || "",
          },
        }),
      });
    } catch (mailErr) {
      console.error("Failed to enqueue COD switch invoice email:", mailErr);
    }
  } else {
    console.error(`COD switch invoice skipped: no recipient for order ${updated.id}`);
  }

  return mapOrder(updated);
}

function daysUntilNextRetry(attemptCount: number): number {
  return attemptCount <= 1 ? 2 : 3;
}

/**
 * Handle a failed payment:
 * - Keep order PENDING with paymentStatus UNPAID
 * - Email user on every failed attempt (including retries)
 * - On first failure only: schedule 5-minute auto-cancel (does not cancel on retry fails)
 */
export async function handlePaymentFailure(orderId: string, paymentIntentId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            productId: true,
            specificationId: true,
            quantity: true,
            color: true,
            size: true,
          },
        },
      },
    });
    if (
      !existing ||
      existing.status === "CANCELLED" ||
      existing.paymentMethod !== "CARD" ||
      ["SUCCEEDED", "PAID", "REFUNDED"].includes(existing.paymentStatus) ||
      (paymentIntentId && existing.stripePaymentIntentId !== paymentIntentId)
    )
      return null;

    if (paymentIntentId && existing.lastFailedPaymentIntentId === paymentIntentId) {
      return null;
    }

    const isFirstFailure = existing.paymentAttemptCount === 0;
    const newAttemptCount = existing.paymentAttemptCount + 1;

    if (newAttemptCount >= existing.maxPaymentAttempts) {
      await restoreStockForOrderItems(tx, existing.items);
      const row = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          paymentAttemptCount: newAttemptCount,
          nextPaymentRetryAt: null,
          lastFailedPaymentIntentId: paymentIntentId ?? existing.lastFailedPaymentIntentId,
        },
        include: {
          user: { select: { fullName: true, name: true, email: true } },
          items: orderItemsInclude,
        },
      });
      await notifyOrderStatusChange(tx, existing.userId, orderId, "CANCELLED");
      return { action: "cancelled" as const, order: mapOrder(row) };
    }

    const nextRetry = new Date();
    nextRetry.setDate(nextRetry.getDate() + daysUntilNextRetry(newAttemptCount));

    const row = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "PENDING",
        paymentStatus: "UNPAID",
        paymentAttemptCount: newAttemptCount,
        nextPaymentRetryAt: nextRetry,
        lastFailedPaymentIntentId: paymentIntentId ?? existing.lastFailedPaymentIntentId,
      },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: orderItemsInclude,
      },
    });

    return {
      action: "unpaid_pending" as const,
      scheduleAutoCancel: isFirstFailure,
      order: mapOrder(row),
      mail: {
        to: row.shippingEmail || row.user?.email || null,
        name: row.shippingFullName || row.user?.fullName || row.user?.name || "Customer",
        orderId: row.id,
        total: Number(row.total).toFixed(2),
        attempt: newAttemptCount,
      },
    };
  });

  if (result?.mail?.to) {
    try {
      const { enqueueEmailJob } = await import("@/lib/job-scheduler");
      await enqueueEmailJob({
        emailType: "payment_failed",
        to: result.mail.to,
        payload: {
          order_id: result.mail.orderId,
          order_number: result.mail.orderId,
          name: result.mail.name,
          total: result.mail.total,
          attempt: result.mail.attempt,
          cancel_minutes: 5,
          retry_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/orders/${orderId}`,
          subject: `Payment Unpaid — Order ${result.mail.orderId} is Pending`,
        },
      });
    } catch (mailErr) {
      console.error("Failed to enqueue payment_failed email:", mailErr);
    }
  }

  // Schedule auto-cancel only once (first failure). Retry failures just re-email.
  if (result?.scheduleAutoCancel) {
    try {
      const { enqueueOrderAutoCancelJob } = await import("@/lib/job-scheduler");
      await enqueueOrderAutoCancelJob({ orderId, delaySeconds: 5 * 60 }); // 5 minutes
      //  await enqueueOrderAutoCancelJob({ orderId, delaySeconds: 5 * 24 * 60 * 60 }); // 5 days
    } catch (scheduleErr) {
      console.error("Failed to schedule order auto-cancel:", scheduleErr);
    }
  }

  return result;
}

/**
 * Find orders due for automatic off-session payment retry.
 */
export async function findOrdersDueForPaymentRetry() {
  return prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentMethod: "CARD",
      paymentStatus: { in: ["FAILED", "UNPAID"] },
      nextPaymentRetryAt: { lte: new Date() },
      stripePaymentIntentId: { not: null },
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, name: true, stripeCustomerId: true },
      },
      items: orderItemsInclude,
    },
  });
}

/**
 * Mark payment success on an existing order after Stripe confirms.
 * Sets payment to PAID and order to PROCESSING, then sends Order Confirmed
 * (Paid / Processing). No separate payment_success email.
 */
export async function confirmExistingOrderPayment(
  orderId: string,
  userId: string,
  paymentStatus: PaymentStatus,
  stripePaymentIntentId: string,
  stripeClientSecret?: string
) {
  if (!["SUCCEEDED", "PAID", "PROCESSING"].includes(paymentStatus)) {
    throw new OrderError("Invalid payment confirmation status");
  }
  // Prefer PAID for confirmed card charges (SUCCEEDED is treated the same elsewhere).
  const confirmedStatus: PaymentStatus =
    paymentStatus === "SUCCEEDED" || paymentStatus === "PAID" ? "PAID" : paymentStatus;

  const { updated, justPaid } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });
    if (!order) throw new OrderError("Order not found", 404);
    if (order.status === "CANCELLED") throw new OrderError("This order has been cancelled.", 400);
    if (order.paymentMethod !== "CARD" || order.stripePaymentIntentId !== stripePaymentIntentId) {
      throw new OrderError("Payment does not match this order.", 409);
    }
    if (["SUCCEEDED", "PAID", "REFUNDED"].includes(order.paymentStatus)) {
      return { updated: order, justPaid: false };
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: confirmedStatus,
        stripeClientSecret: stripeClientSecret ?? order.stripeClientSecret,
        nextPaymentRetryAt: null,
        status: "PROCESSING",
      },
      include: orderInclude,
    });
    return {
      updated,
      justPaid: confirmedStatus === "PAID",
    };
  });

  await removeCartItems(
    userId,
    updated.items.map((item) => ({
      productId: item.productId,
      specificationId: item.specificationId,
    }))
  );

  if (justPaid) {
    const recipientEmail = updated.shippingEmail || updated.user?.email;
    const recipientName =
      updated.shippingFullName || updated.user?.fullName || updated.user?.name || "Customer";
    if (recipientEmail) {
      try {
        const { enqueueEmailJob } = await import("@/lib/job-scheduler");

        // Invoice + order confirmed (Paid / Processing). No separate payment_success email.
        await enqueueEmailJob({
          emailType: "invoice",
          to: recipientEmail,
          payload: buildInvoiceEmailPayload({
            orderId: updated.id,
            name: recipientName,
            subTotal: Number(updated.subTotal),
            tax: Number(updated.tax),
            total: Number(updated.total),
            paymentMethod: "CARD",
            paymentStatus: "PAID",
            orderStatus: "PROCESSING",
            items: updated.items.map((item) => ({
              title: item.product.title,
              imageUrl: selectInvoiceProductImage(item.product, item.color ?? undefined),
              quantity: item.quantity,
              unitPrice: Number(item.price),
              color: item.color ?? undefined,
              size: item.size ?? undefined,
            })),
            shipping: {
              fullName: updated.shippingFullName || recipientName,
              email: recipientEmail,
              phone: updated.shippingPhone || "",
              address: updated.shippingAddress || "",
              city: updated.shippingCity || "",
              postalCode: updated.shippingPostalCode || "",
            },
          }),
        });
      } catch (mailErr) {
        console.error("Failed to enqueue order confirmation email:", mailErr);
      }
    } else {
      console.error(`order confirmation email skipped: no recipient for order ${updated.id}`);
    }
  }

  return mapOrder(updated);
}

async function validateReorderLine(item: OrderItem): Promise<PlaceOrderItemInput> {
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: { specifications: true },
  });
  if (!product || !product.isActive) {
    throw new OrderError(`"${item.title}" is no longer available.`);
  }

  const hasSpecs = product.specifications.length > 0;
  const specificationId = item.specificationId?.trim() || undefined;

  if (hasSpecs) {
    let spec = specificationId
      ? product.specifications.find((s) => s.id === specificationId)
      : undefined;
    if (!spec && (item.color || item.size)) {
      spec = product.specifications.find(
        (s) =>
          s.color.toLowerCase() === (item.color?.trim() ?? "").toLowerCase() &&
          s.size.toLowerCase() === (item.size?.trim() ?? "").toLowerCase()
      );
    }
    if (!spec) {
      throw new OrderError(`"${item.title}" variant is no longer available.`);
    }
    if (spec.qty < item.qty) {
      throw new OrderError(`Not enough stock for "${item.title}". Only ${spec.qty} left.`);
    }
    return {
      productId: product.id,
      specificationId: spec.id,
      quantity: item.qty,
      color: spec.color,
      size: spec.size,
    };
  }

  if (product.stock < item.qty) {
    throw new OrderError(`Not enough stock for "${item.title}". Only ${product.stock} left.`);
  }

  return {
    productId: product.id,
    quantity: item.qty,
  };
}

/** Validate stock for a cancelled order and add its items to the cart for checkout. */
export async function reorderCancelledOrder(orderId: string, userId: string) {
  const order = await findOrderById(orderId, userId);
  if (!order) {
    throw new OrderError("Order not found", 404);
  }
  if (order.status !== "cancelled") {
    throw new OrderError("Only cancelled orders can be reordered.", 400);
  }
  if (!order.items.length) {
    throw new OrderError("This order has no items to reorder.", 400);
  }

  const errors: string[] = [];
  const lines: PlaceOrderItemInput[] = [];

  for (const item of order.items) {
    try {
      lines.push(await validateReorderLine(item));
    } catch (err) {
      if (OrderError.is(err)) {
        errors.push(err.message);
      } else {
        errors.push(`Could not reorder "${item.title}".`);
      }
    }
  }

  if (errors.length) {
    throw new OrderError(errors.join(" "));
  }

  const cart = await syncOrderItemsToCart(userId, lines);
  return { cart };
}
