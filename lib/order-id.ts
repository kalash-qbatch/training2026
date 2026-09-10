import type { Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseOrderRef(ref: string): string {
  return ref.replace(/^#/, "").trim();
}

/** Display the order UUID as-is. */
export function displayOrderRef(order: { id: string }): string {
  return order.id;
}

export function formatOrderRefDisplay(ref: string): string {
  return parseOrderRef(ref) || "—";
}

export function orderRouteId(order: { id: string }): string {
  return order.id;
}

export function resolveOrderLookup(ref: string): { id?: string } {
  const cleaned = parseOrderRef(ref);
  if (!cleaned) return {};
  if (isUuid(cleaned)) return { id: cleaned };
  return { id: cleaned };
}

export function buildOrderUniqueWhere(ref: string, userId?: string): Prisma.OrderWhereInput {
  const lookup = resolveOrderLookup(ref);
  const userFilter = userId ? { userId } : {};
  return { id: lookup.id ?? parseOrderRef(ref) ?? ref, ...userFilter };
}
