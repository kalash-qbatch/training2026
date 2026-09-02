import { mapStripeError } from "@/lib/services/payment-errors";

describe("payment-errors — mapStripeError", () => {
  it("maps decline_code to user-friendly message", () => {
    const result = mapStripeError({
      type: "StripeCardError",
      decline_code: "insufficient_funds",
    });

    expect(result.category).toBe("INSUFFICIENT_FUNDS");
    expect(result.title).toBe("Insufficient Funds");
    expect(result.recoverable).toBe(true);
  });

  it("maps error code when decline_code is absent", () => {
    const result = mapStripeError({
      type: "StripeCardError",
      code: "expired_card",
    });

    expect(result.category).toBe("EXPIRED_CARD");
    expect(result.title).toBe("Card Expired");
  });

  it("returns fallback for unknown errors", () => {
    const result = mapStripeError({ type: "UnknownError" });

    expect(result.category).toBe("SYSTEM_ERROR");
    expect(result.title).toBe("Payment Failed");
    expect(result.recoverable).toBe(true);
  });

  it("handles StripeCardError type without specific codes", () => {
    const result = mapStripeError({ type: "StripeCardError" });

    expect(result.category).toBe("CARD_DECLINED");
    expect(result.message).toMatch(/declined/i);
  });

  it("handles StripeConnectionError as system error", () => {
    const result = mapStripeError({ type: "StripeConnectionError" });

    expect(result.category).toBe("SYSTEM_ERROR");
    expect(result.title).toBe("Service Temporarily Unavailable");
  });
});
