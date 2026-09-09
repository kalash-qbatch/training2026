import { CART_TTL_MINUTES, CART_TTL_MS, cartExpiryCutoff } from "@/lib/cart-expiration";

describe("cart expiration", () => {
  it("keeps cart items for 15 minutes", () => {
    expect(CART_TTL_MINUTES).toBe(15);
    expect(CART_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("calculates the expiration cutoff in milliseconds", () => {
    const now = Date.UTC(2026, 8, 9, 10, 30);

    expect(cartExpiryCutoff(now)).toEqual(new Date(now - 15 * 60 * 1000));
  });
});
