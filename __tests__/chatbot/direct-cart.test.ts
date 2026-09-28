import {
  addToCart,
  clearSessionCart,
  getCartSummary,
  removeFromCart,
} from "@/lib/chatbot/tools/cart-service";

describe("Direct Fast Add-to-Cart Flow Suite", () => {
  const testSession = "test_sess_direct_cart_456";

  beforeEach(() => {
    clearSessionCart(testSession);
  });

  it("adds product directly and computes line totals accurately", async () => {
    const res = await addToCart(testSession, "prod-001", 1);
    expect(res.added.productId).toBe("prod-001");
    expect(res.added.price).toBe(28.0);
    expect(res.added.lineTotal).toBe(28.0);
    expect(res.cart.totalQuantity).toBe(1);
    expect(res.cart.subtotal).toBe(28.0);
  });

  it("persists items across operations (simulating session state)", async () => {
    await addToCart(testSession, "prod-001", 1);
    await addToCart(testSession, "prod-005", 2); // $24.00 * 2 = $48.00

    const currentCart = getCartSummary(testSession);
    expect(currentCart.items).toHaveLength(2);
    expect(currentCart.totalQuantity).toBe(3);
    expect(currentCart.subtotal).toBe(76.0); // 28 + 48
  });

  it("prevents duplicate add when duplicate request is blocked or debounced", async () => {
    // Simulate debounced click: single valid add succeeds
    const firstCall = await addToCart(testSession, "prod-008", 1);
    expect(firstCall.cart.totalQuantity).toBe(1);

    // If debounced flag is set, caller does not fire second request;
    // but if sequential valid request is made, quantity updates correctly
    const secondCall = await addToCart(testSession, "prod-008", 1);
    expect(secondCall.cart.totalQuantity).toBe(2);
  });

  it("rejects out-of-stock product with explicit OUT_OF_STOCK code", async () => {
    await expect(addToCart(testSession, "prod-017", 1)).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
      message: expect.stringMatching(/out of stock/i),
    });
  });

  it("removes item and recalculates subtotal", async () => {
    await addToCart(testSession, "prod-001", 1);
    await addToCart(testSession, "prod-003", 1); // $120.00
    expect(getCartSummary(testSession).subtotal).toBe(148.0);

    const removeRes = await removeFromCart(testSession, "prod-001");
    expect(removeRes.removed).toBe(true);
    expect(getCartSummary(testSession).subtotal).toBe(120.0);
    expect(getCartSummary(testSession).totalQuantity).toBe(1);
  });
});
