import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mapOrder } from "@/lib/mappers";
import type { Order } from "@/types";

const TAX_RATE = 0.08;

export type PlaceOrderItemInput = {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
};

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

      const spec =
        item.color && item.size
          ? product.specifications.find(
              (s) =>
                s.color.toLowerCase() === item.color!.toLowerCase() &&
                s.size.toLowerCase() === item.size!.toLowerCase()
            )
          : undefined;

      const available = spec ? spec.qty : product.stock;

      if (available < item.quantity) {
        throw new OrderError(
          `Not enough stock for "${product.title}". Only ${available} left.`
        );
      }

      if (spec) {
        const nextQty = Math.max(0, available - item.quantity);
        await tx.specification.update({
          where: { id: spec.id },
          data: { qty: nextQty },
        });
        const specs = await tx.specification.findMany({
          where: { productId: product.id },
        });
        const sum = specs.reduce(
          (acc, s) => acc + (s.id === spec.id ? nextQty : s.qty),
          0
        );
        await tx.product.update({
          where: { id: product.id },
          data: { stock: sum },
        });
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: Math.max(0, product.stock - item.quantity) },
        });
      }

      lineData.push({
        productId: product.id,
        quantity: item.quantity,
        price: Number(product.price),
        color: item.color,
        size: item.size,
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

export type AdminOrderFilters = {
  search?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
};

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
