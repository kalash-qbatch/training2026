export const CART_TTL_MINUTES = 15;
export const CART_TTL_MS = CART_TTL_MINUTES * 60_000;

export function cartExpiryCutoff(now = Date.now()): Date {
  return new Date(now - CART_TTL_MS);
}
