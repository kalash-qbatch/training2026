import type { OrderStatus as DbOrderStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { displayOrderRef } from "@/lib/order-id";
import { findOrderById, findOrders } from "@/lib/services/orders";
import { formatCurrency } from "@/lib/utils";
import type { Order } from "@/types";

export type UserOrderIntent =
  | { kind: "count"; status?: DbOrderStatus }
  | { kind: "status"; status?: DbOrderStatus }
  | { kind: "list"; status?: DbOrderStatus }
  | { kind: "lookup"; orderRef: string }
  | { kind: "cancel_action" };

const ORDER_TOPIC =
  /\b(orders?|order\s*#|order\s*id|order\s*status|tracking|shipment|ship+e?d?|deliver+e?d?|delivred|deliverd|cancel+e?d?|cncel|pend+ing?|process+ing?|rejected|my\s+order)\b/i;

const COUNT_RE = /\b(how\s+many|how\s+much|count|number\s+of|total|how\s+many\s+are)\b/i;

const LIST_RE = /\b(show|list|see|view|share|give|filter)\b|\bonly\b|\bjust\b/i;

const STATUS_RE = /\b(status|where\s+is|track(?:ing)?|update|progress|latest|last)\b/i;

const LOOKUP_RE =
  /\b(?:order\s*(?:#|id|ref|number)?\s*[:#-]?\s*)([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/i;

/** "please cancel my order" — action request, not a status filter. */
const CANCEL_ACTION_RE =
  /\b((please|can\s+you)\s+)?(cancel|cancelling|void)\s+(my\s+)?(this\s+|the\s+|an?\s+)?orders?\b|\bcancel\s+it\b|\bi\s+want\s+to\s+cancel\b/i;

const STATUS_PATTERNS: Array<{ status: DbOrderStatus; re: RegExp }> = [
  { status: "CANCELLED", re: /\b(cancel+e?d?|cncel|canceld|canceled)\b/i },
  { status: "PENDING", re: /\bpend+ings?\b/i },
  { status: "PROCESSING", re: /\bprocess+ings?\b/i },
  { status: "SHIPPED", re: /\b(ship+e?d?|shiped|shpped)\b/i },
  // covers delivered / deliverd / delivred / delievered
  { status: "DELIVERED", re: /\b(deliv(?:er)?e?d|deliver+e?d?|delivred|delievered)\b/i },
  { status: "REJECTED", re: /\breject+e?ds?\b/i },
];

const GUEST_ORDER_REPLY =
  "Please sign in to check your order count and status. After logging in you can also open [My Orders](/orders).";

const CANCEL_ACTION_REPLY =
  "I can't cancel orders from chat. Open [My Orders](/orders?status=cancelled), pick the order, and use Cancel there. If you meant **cancelled orders**, ask “show cancelled only” or “how many are cancelled”.";

const LIST_PAGE_SIZE = 8;

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function ordersListHref(status?: DbOrderStatus): string {
  if (!status) return "/orders";
  return `/orders?status=${status.toLowerCase()}`;
}

function extractStatusFilter(text: string): DbOrderStatus | undefined {
  for (const { status, re } of STATUS_PATTERNS) {
    if (re.test(text)) return status;
  }
  return undefined;
}

function formatOrderLine(order: Order): string {
  const ref = displayOrderRef(order);
  const when = order.date ? new Date(order.date).toLocaleDateString() : "unknown date";
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
  return `- **#${ref.slice(0, 8)}…** — ${statusLabel(order.status)} · ${formatCurrency(order.amount)} · ${itemCount} item(s) · ${when} · [View](/orders/${order.id})`;
}

function isFilterStyleCancel(text: string): boolean {
  return /\b(only|just|how\s+many|count|show|list|are|all\s+cancelled|cancelled\s+orders?)\b/i.test(
    text
  );
}

/**
 * Detect personal order questions (count, status, list, lookup by id).
 * Supports status filters and common typos like "cncel".
 */
export function detectUserOrderIntent(message: string): UserOrderIntent | null {
  const text = message.trim();
  if (!text) return null;

  const status = extractStatusFilter(text);

  // Cancel *action* vs filter ("cncel only", "how many cancelled")
  if (CANCEL_ACTION_RE.test(text) && !isFilterStyleCancel(text)) {
    return { kind: "cancel_action" };
  }

  if (!ORDER_TOPIC.test(text) && !status) return null;

  // Product shopping: "order a watch" / "place an order"
  if (/\b(place|placing|make|buy|purchase|want\s+to)\b.*\border\b/i.test(text)) {
    return null;
  }
  if (/\border\s+(a|an|the|some|me)\b/i.test(text)) return null;

  const lookup = text.match(LOOKUP_RE);
  if (lookup?.[1]) {
    return { kind: "lookup", orderRef: lookup[1] };
  }

  if (COUNT_RE.test(text)) {
    return { kind: "count", status };
  }

  // "cncel only", "cancelled only", "only cancelled", "show cancelled"
  if (status && (/\b(only|just)\b/i.test(text) || LIST_RE.test(text))) {
    return { kind: "list", status };
  }

  if (status && !STATUS_RE.test(text)) {
    return { kind: "list", status };
  }

  if (STATUS_RE.test(text)) return { kind: "status", status };

  if (LIST_RE.test(text) || /\b(my|our)\s+orders?\b/i.test(text) || /\borders?\b/i.test(text)) {
    return { kind: "list", status };
  }

  if (status) return { kind: "list", status };

  return null;
}

export async function buildUserOrderReply(
  userId: string | null,
  intent: UserOrderIntent
): Promise<string> {
  if (intent.kind === "cancel_action") {
    return CANCEL_ACTION_REPLY;
  }

  if (!userId) return GUEST_ORDER_REPLY;

  try {
    if (intent.kind === "lookup") {
      const order = await findOrderById(intent.orderRef, userId);
      if (!order) {
        return `I couldn't find an order matching \`${intent.orderRef}\` on your account. Check [My Orders](/orders) or share the full order id.`;
      }
      const items = order.items
        .slice(0, 5)
        .map((item) => `${item.title} ×${item.qty}`)
        .join(", ");
      return [
        `Here's the status for order **#${displayOrderRef(order).slice(0, 8)}…**:`,
        `- Status: **${statusLabel(order.status)}**`,
        `- Payment: ${order.paymentStatus} (${order.paymentMethod})`,
        `- Total: ${formatCurrency(order.amount)}`,
        `- Placed: ${new Date(order.date).toLocaleDateString()}`,
        items ? `- Items: ${items}` : null,
        `- [View order details](/orders/${order.id})`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    const filterStatus = intent.status;

    if (intent.kind === "count") {
      if (filterStatus) {
        const listHref = ordersListHref(filterStatus);
        const { orders, total } = await findOrders(
          1,
          LIST_PAGE_SIZE,
          userId,
          undefined,
          filterStatus
        );
        if (total === 0) {
          return `You have **0** ${statusLabel(filterStatus)} orders. See everything in [My Orders](${listHref}).`;
        }
        return [
          `You have **${total}** ${statusLabel(filterStatus)} order${total === 1 ? "" : "s"} in total.`,
          total > orders.length ? `Here are the ${orders.length} most recent:` : "Here they are:",
          ...orders.map(formatOrderLine),
          total > orders.length
            ? `Showing ${orders.length} of ${total}. Open [My Orders](${listHref}) for the full list.`
            : `You can also open [My Orders](${listHref}) anytime.`,
        ].join("\n");
      }

      const [grouped, { orders, total }] = await Promise.all([
        prisma.order.groupBy({
          by: ["status"],
          where: { userId },
          _count: { _all: true },
        }),
        findOrders(1, 5, userId),
      ]);

      if (total === 0) {
        return "You don't have any orders yet. Browse the [catalog](/products) when you're ready to shop, then check back here for status updates.";
      }

      const statusSummary = grouped
        .map((row) => `${row._count._all} ${statusLabel(row.status)}`)
        .join(", ");

      return [
        `You have **${total}** order${total === 1 ? "" : "s"} on your account.`,
        statusSummary ? `By status: ${statusSummary}.` : null,
        "Recent orders:",
        ...orders.map(formatOrderLine),
        total > orders.length
          ? `Showing the ${orders.length} most recent. See all in [My Orders](/orders).`
          : "You can also open [My Orders](/orders) anytime.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const listHref = ordersListHref(filterStatus);
    const { orders, total } = await findOrders(1, LIST_PAGE_SIZE, userId, undefined, filterStatus);

    if (total === 0) {
      if (filterStatus) {
        return `You don't have any ${statusLabel(filterStatus)} orders. Open [My Orders](${listHref}) to review your full history.`;
      }
      return "You don't have any orders yet. Browse the [catalog](/products) when you're ready to shop, then check back here for status updates.";
    }

    if (filterStatus) {
      return [
        `You have **${total}** ${statusLabel(filterStatus)} order${total === 1 ? "" : "s"}.`,
        total > orders.length ? `Showing the ${orders.length} most recent:` : "Here they are:",
        ...orders.map(formatOrderLine),
        total > orders.length
          ? `Open [My Orders](${listHref}) to see all ${total}.`
          : "Ask for another status (pending, processing, shipped, delivered) anytime.",
      ].join("\n");
    }

    const latest = orders[0];
    const heading =
      intent.kind === "list"
        ? `Here are your ${Math.min(orders.length, total)} most recent order${total === 1 ? "" : "s"} (of ${total}):`
        : `Your latest order is **${statusLabel(latest.status)}** (${formatCurrency(latest.amount)}). Recent orders:`;

    return [
      heading,
      ...orders.map(formatOrderLine),
      total > orders.length
        ? `See the full list in [My Orders](/orders). You can also ask for cancelled-only, shipped-only, etc.`
        : "Need a filter? Ask for cancelled, shipped, delivered, or processing orders.",
    ].join("\n");
  } catch (error) {
    console.error("[user-orders] Failed to load orders for chat:", error);
    return "I couldn't load your orders right now. Please try again, or open [My Orders](/orders).";
  }
}

export { GUEST_ORDER_REPLY };
