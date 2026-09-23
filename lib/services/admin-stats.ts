import { prisma } from "@/lib/db";

export type AdminDashboardStats = {
  products: {
    total: number;
    active: number;
    inactive: number;
    addedLast24h: number;
  };
  inventory: {
    totalUnits: number;
    lowStockVariants: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
  };
  revenue: {
    /** Sum of order totals excluding CANCELLED */
    grossExcludingCancelled: number;
    /** Sum where paymentStatus = SUCCEEDED */
    paid: number;
    /** Sum of all orders including cancelled */
    allOrders: number;
  };
  generatedAt: string;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

/**
 * Live catalog + order metrics for the admin assistant.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalProducts,
    activeProducts,
    inactiveProducts,
    addedLast24h,
    inventoryAgg,
    lowStockVariants,
    totalOrders,
    ordersByStatus,
    ordersByPayment,
    revenueAll,
    revenueExCancelled,
    revenuePaid,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.product.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.specification.aggregate({ _sum: { qty: true } }),
    prisma.specification.count({ where: { qty: { gt: 0, lte: 5 } } }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["paymentStatus"], _count: { _all: true } }),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: { in: ["SUCCEEDED", "PAID"] } },
      _sum: { total: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of ordersByStatus) {
    byStatus[row.status] = row._count._all;
  }

  const byPaymentStatus: Record<string, number> = {};
  for (const row of ordersByPayment) {
    byPaymentStatus[row.paymentStatus] = row._count._all;
  }

  return {
    products: {
      total: totalProducts,
      active: activeProducts,
      inactive: inactiveProducts,
      addedLast24h,
    },
    inventory: {
      totalUnits: inventoryAgg._sum.qty ?? 0,
      lowStockVariants,
    },
    orders: {
      total: totalOrders,
      byStatus,
      byPaymentStatus,
    },
    revenue: {
      grossExcludingCancelled: Number(revenueExCancelled._sum.total ?? 0),
      paid: Number(revenuePaid._sum.total ?? 0),
      allOrders: Number(revenueAll._sum.total ?? 0),
    },
    generatedAt: new Date().toISOString(),
  };
}

export function formatAdminStatsContext(stats: AdminDashboardStats): string {
  const statusLines = Object.entries(stats.orders.byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `  - ${status}: ${count}`)
    .join("\n");

  const paymentLines = Object.entries(stats.orders.byPaymentStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `  - ${status}: ${count}`)
    .join("\n");

  return `LIVE ADMIN STATS (as of ${stats.generatedAt}):
Products:
  - Total products: ${stats.products.total}
  - Active: ${stats.products.active}
  - Inactive: ${stats.products.inactive}
  - Added in last 24h: ${stats.products.addedLast24h}
Inventory:
  - Total units across variants: ${stats.inventory.totalUnits}
  - Low-stock variants (1–5 qty): ${stats.inventory.lowStockVariants}
Orders:
  - Total orders: ${stats.orders.total}
  - By order status:
${statusLines || "  - (none)"}
  - By payment status:
${paymentLines || "  - (none)"}
Revenue:
  - Paid revenue (payment PAID/SUCCEEDED): ${money(stats.revenue.paid)}
  - Gross excluding CANCELLED orders: ${money(stats.revenue.grossExcludingCancelled)}
  - Sum of all order totals (includes cancelled): ${money(stats.revenue.allOrders)}

When answering metric questions, use ONLY these numbers. Prefer "Paid revenue" for revenue unless the user asks otherwise.`;
}
