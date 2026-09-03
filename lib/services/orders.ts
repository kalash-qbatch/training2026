import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

import { TAX_RATE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { mapOrder } from "@/lib/mappers";
import {
  allocateOrderNumber,
  buildOrderUniqueWhere,
  hasValidOrderNumber,
  parseOrderRef,
} from "@/lib/order-id";
import { ensureOrderNumberInfrastructure } from "@/lib/order-number-setup";
import {
  removeCartItems,
  restoreCartFromOrderItems,
  syncOrderItemsToCart,
} from "@/lib/services/cart";
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

const orderInclude = {
  user: { select: { fullName: true, name: true, email: true } },
  items: { include: { product: true } },
} as const;

async function backfillOrderNumberIfMissing<
  T extends { id: string; orderNumber: number | null | undefined },
>(row: T): Promise<T> {
  if (hasValidOrderNumber(row.orderNumber)) return row;

  try {
    const orderNumber = await prisma.$transaction(async (tx) => allocateOrderNumber(tx));
    const updated = await prisma.order.update({
      where: { id: row.id },
      data: { orderNumber },
      include: orderInclude,
    });
    return updated as unknown as T;
  } catch (err) {
    console.error("orderNumber backfill error:", err);
    return row;
  }
}

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

  await ensureOrderNumberInfrastructure();

  return prisma.$transaction(
    async (tx) => {
      const lineData: Array<{
        productId: string;
        specificationId?: string;
        quantity: number;
        price: number;
        color?: string;
        size?: string;
      }> = [];

      for (const item of items) {
        if (item.quantity < 1) {
          throw new OrderError("Invalid quantity");
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { specifications: true },
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

        lineData.push({
          productId: product.id,
          specificationId,
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
      // Card orders stay PENDING until payment succeeds; COD starts as PROCESSING.
      const orderStatus = opts?.orderStatus ?? (paymentMethod === "COD" ? "PROCESSING" : "PENDING");
      const orderNumber = await allocateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
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
          items: { include: { product: true } },
        },
      });

      await notifyOrderPlaced(tx, userId, order.id, order.orderNumber);

      for (const line of lineData) {
        await tx.cartItem.deleteMany({
          where: {
            userId,
            productId: line.productId,
            specificationId: line.specificationId ?? null,
          },
        });
      }

      return mapOrder(order);
    },
    { maxWait: 15_000, timeout: 30_000 }
  );
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
  await ensureOrderNumberInfrastructure();

  const where = userId ? { userId } : {};
  const total = await prisma.order.count({ where });
  const rows = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const hydrated = await Promise.all(rows.map((row) => backfillOrderNumberIfMissing(row)));

  return {
    orders: hydrated.map(mapOrder),
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
  await ensureOrderNumberInfrastructure();

  let row = await prisma.order.findFirst({
    where: buildOrderUniqueWhere(id, userId),
    include: orderInclude,
  });
  if (!row) return null;

  row = await backfillOrderNumberIfMissing(row);

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
        items: { include: { product: true } },
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

  return prisma.$transaction(async (tx) => {
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

    // Block status changes for card orders where payment is not yet completed,
    // except cancellation (e.g. after all payment retries fail).
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
        items: { include: { product: true } },
      },
    });

    await notifyOrderStatusChange(tx, existing.userId, id, status, row.orderNumber);

    return mapOrder(row);
  });
}

function buildOrderWhere(opts: AdminOrderFilters): Prisma.OrderWhereInput {
  const q = opts.search?.trim();
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
      q
        ? {
            OR: [
              ...(/^\d+$/.test(parseOrderRef(q))
                ? [{ orderNumber: Number(parseOrderRef(q)) }]
                : []),
              { id: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
}

export async function findAdminOrders(opts: AdminOrderFilters = {}) {
  await ensureOrderNumberInfrastructure();

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

  const hydrated = await Promise.all(rows.map((row) => backfillOrderNumberIfMissing(row)));

  return {
    orders: hydrated.map(mapOrder),
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
      items: { include: { product: true } },
    },
  });
}

/**
 * Update an order's payment status (called by webhooks / checkout confirm).
 */
export async function updateOrderPaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
  const order = await prisma.order.update({
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
      items: { include: { product: true } },
    },
  });

  return mapOrder(updated);
}

/**
 * Switch a failed card order to COD (retry with different payment method).
 */
export async function switchOrderToCod(orderId: string, userId: string) {
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
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      stripePaymentIntentId: null,
      stripeClientSecret: null,
      nextPaymentRetryAt: null,
      status: "PROCESSING",
    },
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });

  await removeCartItems(
    userId,
    updated.items.map((item) => ({
      productId: item.productId,
      specificationId: item.specificationId,
    }))
  );

  return mapOrder(updated);
}

function daysUntilNextRetry(attemptCount: number): number {
  return attemptCount <= 1 ? 2 : 3;
}

/**
 * Handle a failed payment: increment attempts, schedule auto-retry, or cancel + restock.
 */
export async function handlePaymentFailure(orderId: string, paymentIntentId?: string) {
  const result = await prisma.$transaction(async (tx) => {
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
    if (!existing || existing.status === "CANCELLED") return null;

    if (paymentIntentId && existing.lastFailedPaymentIntentId === paymentIntentId) {
      return null;
    }

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
          items: { include: { product: true } },
        },
      });
      await notifyOrderStatusChange(
        tx,
        existing.userId,
        orderId,
        "CANCELLED",
        existing.orderNumber
      );
      return { action: "cancelled" as const, order: mapOrder(row) };
    }

    const nextRetry = new Date();
    nextRetry.setDate(nextRetry.getDate() + daysUntilNextRetry(newAttemptCount));

    const row = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "PENDING",
        paymentStatus: "FAILED",
        paymentAttemptCount: newAttemptCount,
        nextPaymentRetryAt: nextRetry,
        lastFailedPaymentIntentId: paymentIntentId ?? existing.lastFailedPaymentIntentId,
      },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    });

    return { action: "retry_scheduled" as const, order: mapOrder(row) };
  });

  if (result?.action === "cancelled" && result.order) {
    await restoreCartFromOrderItems(
      result.order.userId,
      result.order.items.map((item) => ({
        productId: item.productId,
        specificationId: item.specificationId,
        quantity: item.qty,
      }))
    );
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
      paymentStatus: "FAILED",
      nextPaymentRetryAt: { lte: new Date() },
      stripePaymentIntentId: { not: null },
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, name: true, stripeCustomerId: true },
      },
      items: { include: { product: true } },
    },
  });
}

/**
 * Mark payment success on an existing order after Stripe confirms.
 */
export async function confirmExistingOrderPayment(
  orderId: string,
  userId: string,
  paymentStatus: PaymentStatus,
  stripePaymentIntentId: string,
  stripeClientSecret?: string
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

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      paymentMethod: "CARD",
      stripePaymentIntentId,
      stripeClientSecret: stripeClientSecret ?? order.stripeClientSecret,
      nextPaymentRetryAt: null,
      status: "PROCESSING",
    },
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });

  await removeCartItems(
    userId,
    updated.items.map((item) => ({
      productId: item.productId,
      specificationId: item.specificationId,
    }))
  );

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
