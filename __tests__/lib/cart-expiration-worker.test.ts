import { expireCartItems } from "@/lib/services/cart";
import { startCartExpirationWorker } from "@/lib/services/cart-expiration-worker";

jest.mock("../../lib/services/cart", () => ({ expireCartItems: jest.fn() }));

it("cleans immediately, prevents duplicate workers, and keeps sweeping after errors", async () => {
  jest.useFakeTimers();
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  const expire = jest.mocked(expireCartItems);
  expire.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValue({ count: 1 });
  try {
    startCartExpirationWorker();
    startCartExpirationWorker();
    await jest.advanceTimersByTimeAsync(0);
    expect(expire).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(expire).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(expire).toHaveBeenCalledTimes(3);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
    errorLog.mockRestore();
  }
});
