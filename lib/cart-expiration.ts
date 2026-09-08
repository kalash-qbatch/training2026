export const CART_TTL_MS = 15 * 60_000;

export function cartExpiryCutoff(now = Date.now()): Date {
  return new Date(now - CART_TTL_MS);
}
