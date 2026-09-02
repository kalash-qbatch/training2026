import type { Prisma } from "@prisma/client";

import type { Order } from "@/types";

/** First short order number issued by the database sequence. */
export const ORDER_NUMBER_START = 4_353_452;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseOrderRef(ref: string): string {
  return ref.replace(/^#/, "").trim();
}

export function hasValidOrderNumber(orderNumber: number | null | undefined): orderNumber is number {
  return typeof orderNumber === "number" && Number.isFinite(orderNumber) && orderNumber > 0;
}

export function formatOrderRef(orderNumber: number): string {
  return `#${orderNumber}`;
}

/** Single display helper — use everywhere an order id is shown to users. */
export function displayOrderRef(order: Pick<Order, "id" | "orderNumber">): string {
  if (hasValidOrderNumber(order.orderNumber)) {
    return formatOrderRef(order.orderNumber);
  }
  return formatOrderRefDisplay(order.id);
}

export function formatOrderRefDisplay(ref: string | number): string {
  if (typeof ref === "number") return formatOrderRef(ref);
  const cleaned = parseOrderRef(ref);
  if (/^\d+$/.test(cleaned)) return formatOrderRef(Number(cleaned));
  if (isUuid(cleaned)) return `#${cleaned.slice(0, 8).toUpperCase()}`;
  return cleaned ? `#${cleaned}` : "#—";
}

export function orderRouteId(order: Pick<Order, "id" | "orderNumber">): string {
  if (hasValidOrderNumber(order.orderNumber)) return String(order.orderNumber);
  return order.id;
}

export function resolveOrderLookup(ref: string): { id?: string; orderNumber?: number } {
  const cleaned = parseOrderRef(ref);
  if (!cleaned) return {};
  if (/^\d+$/.test(cleaned)) return { orderNumber: Number(cleaned) };
  if (isUuid(cleaned)) return { id: cleaned };
  return { id: ref };
}

export function buildOrderUniqueWhere(ref: string, userId?: string): Prisma.OrderWhereInput {
  const lookup = resolveOrderLookup(ref);
  const userFilter = userId ? { userId } : {};

  if (lookup.orderNumber != null) {
    return { orderNumber: lookup.orderNumber, ...userFilter };
  }

  return { id: lookup.id ?? ref, ...userFilter };
}

export async function allocateOrderNumber(tx: {
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
}): Promise<number> {
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('order_number_seq')::bigint AS nextval
  `;
  const orderNumber = Number(rows[0]?.nextval);
  if (!hasValidOrderNumber(orderNumber)) {
    throw new Error("Failed to allocate order number");
  }
  return orderNumber;
}
