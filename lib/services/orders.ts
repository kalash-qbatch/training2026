import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mapOrder } from "@/lib/mappers";
import type { AdminOrderFilters, Order, PlaceOrderItemInput } from "@/types";
import { TAX_RATE } from "@/lib/constants";
import {
  notifyOrderPlaced,
  notifyOrderStatusChange,
} from "@/lib/services/notifications";

export type { PlaceOrderItemInput, AdminOrderFilters };

// Error handling component with status code as well
export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export async function createOrder(userId: string, items: PlaceOrderItemInput[]) {
  if (!items.length) {
    throw new OrderError("Cart is empty");
  }

  return prisma.$transaction(async (tx) => {
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
      let specificationId: string | undefined =
        item.specificationId?.trim() || undefined;

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
          throw new OrderError(
            `A valid variant selection is required for "${product.title}".`
          );
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
          throw new OrderError(
            `Not enough stock for "${product.title}". Only ${spec.qty} left.`
          );
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

    const subTotal = lineData.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0
    );
    const tax = Number((subTotal * TAX_RATE).toFixed(2));
    const total = Number((subTotal + tax).toFixed(2));

    const order = await tx.order.create({
      data: {
        userId,
        status: "PROCESSING",
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

    await notifyOrderPlaced(tx, userId, order.id);

    return mapOrder(order);
  });
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
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: { include: { product: true } },
    },
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

export async function findOrderById(
  id: string,
  userId?: string
): Promise<Order | null> {
  const row = await prisma.order.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
    include: {
      user: { select: { fullName: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });
  return row ? mapOrder(row) : null;
}

const ALLOWED_STATUS_UPDATES = new Set<OrderStatus>([
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

type TxClient = Prisma.TransactionClient;

async function syncProductStockFromSpecs(
  tx: TxClient,
  productId: string
) {
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
        throw new OrderError(
          `Not enough stock to reactivate order.`
        );
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
        throw new OrderError(
          `Cannot reactivate order — variant missing for "${product.title}".`
        );
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
        throw new OrderError(
          `Not enough stock to reactivate order for "${product.title}".`
        );
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
      data: { status },
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    });

    await notifyOrderStatusChange(tx, existing.userId, id, status);

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
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 8;
  const where = buildOrderWhere(opts);

  const [total, rows, aggregates, unitsAgg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        user: { select: { fullName: true, name: true, email: true } },
        items: { include: { product: true } },
      },
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

