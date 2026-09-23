const ADMIN_TOPIC =
  /\b(admin|dashboard|product|products|order|orders|inventory|stock|sku|variant|variants|category|categories|bulk|upload|csv|image|images|price|prices|status|pending|ship|shipping|fulfill|refund|cancel|active|inactive|specification|specifications|color|size|qty|quantity|add|edit|update|delete|remove|create|manage|catalog|list|filter|search|low\s*stock|out\s*of\s*stock|revenue|sales|analytics|metrics|stats|statistics|total|how\s+many|count|overview|summary|report)\b/i;

const OFF_TOPIC =
  /\b(python|javascript|typescript|java\b|c\+\+|golang|rust\b|html|css|react native|code|coding|program|programming|script|function|algorithm|game|games|tutorial|homework|essay|poem|story|weather|recipe|recipes|politics|bitcoin|crypto|how\s+to\s+(create|build|make|write|code|install)\s+(a\s+)?(website|app|game)|chatgpt|openai)\b/i;

/** Customer shopping phrasing — not admin panel work. */
const CUSTOMER_SHOPPING =
  /\b(i\s+want\b|buy\s+me|my\s+cart|add\s+to\s+(my\s+)?cart|checkout|recommend\s+me|what\s+(watches|shirts|glasses|headphones?)\s+do\s+you\s+have|show\s+me\s+(products?\s+)?under)\b/i;

const OFF_TOPIC_REFUSAL =
  "I can only help with Bhai ka Store admin tasks — products, inventory, orders, revenue, and catalog management. Ask something about the admin panel.";

/**
 * Heuristic gate: clearly off-topic / customer shopping and not admin-related → refuse.
 */
export function getAdminOffTopicRefusal(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  const isAdmin = ADMIN_TOPIC.test(text);
  if ((OFF_TOPIC.test(text) || CUSTOMER_SHOPPING.test(text)) && !isAdmin) {
    return OFF_TOPIC_REFUSAL;
  }
  return null;
}

export const SYSTEM_ADMIN_PROMPT = `You are the Admin Assistant for "Bhai ka Store".

SCOPE (STRICT):
- Help ONLY with admin-panel work: products, variants (color/size/stock/SKU), categories, orders, order/payment status, inventory, revenue/sales metrics, bulk CSV upload, and product images.
- If the user asks about anything unrelated (coding, games, homework, general knowledge, personal shopping as a customer, etc.), refuse politely in one or two short sentences. Example:
  "I can only help with admin tasks for Bhai ka Store — products, orders, inventory, revenue, and catalog management."
- Do NOT write code, tutorials, or essays.

METRICS:
1. When LIVE ADMIN STATS are provided below, use those exact numbers for totals, revenue, and status counts.
2. Prefer "Paid revenue (payment PAID/SUCCEEDED)" when the user asks about revenue/sales unless they specify otherwise.
3. Never invent order IDs, stock counts, revenue, or product details beyond the provided stats and your admin UI knowledge.
4. If a metric is missing from LIVE ADMIN STATS, say you don't have that figure and point them to /admin/orders or /admin/products.

GUIDANCE:
1. Be concise and practical. Prefer short bullet answers for metrics.
2. Point users to the right screens when useful:
   - Products: /admin/products
   - Orders: /admin/orders
3. Keep answers professional and short.`;

export { OFF_TOPIC_REFUSAL as ADMIN_OFF_TOPIC_REFUSAL };
