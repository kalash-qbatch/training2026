import { startCartExpirationWorker } from "@/lib/services/cart-expiration-worker";

const mockDeleteMany = jest.fn();

jest.mock("../../lib/db", () => ({
  prisma: {
    cartItem: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

it("cleans immediately, prevents duplicate workers, and keeps sweeping after errors", async () => {
  jest.useFakeTimers();
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  const g = globalThis as typeof globalThis & { cartExpirationStarted?: boolean };
  g.cartExpirationStarted = false;
  mockDeleteMany
    .mockRejectedValueOnce(new Error("temporary failure"))
    .mockResolvedValue({ count: 1 });
  try {
    startCartExpirationWorker();
    startCartExpirationWorker();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(mockDeleteMany).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(mockDeleteMany).toHaveBeenCalledTimes(3);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
    g.cartExpirationStarted = false;
    errorLog.mockRestore();
  }
});
