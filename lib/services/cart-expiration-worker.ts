import { expireCartItems } from "@/lib/services/cart";

const worker = globalThis as typeof globalThis & { cartExpirationStarted?: boolean };

/** Persisted timestamps survive restarts; sweeps run even with no browsers open. */
export function startCartExpirationWorker() {
  if (worker.cartExpirationStarted) return;
  worker.cartExpirationStarted = true;

  const sweep = async () => {
    try {
      await expireCartItems();
    } catch (error) {
      console.error("Cart expiration cleanup failed", error);
    } finally {
      // Schedule after completion to avoid overlapping database sweeps.
      setTimeout(sweep, 1_000).unref();
    }
  };
  void sweep();
}
