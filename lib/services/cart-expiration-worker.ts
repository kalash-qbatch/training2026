import { cartExpiryCutoff } from "@/lib/cart-expiration";
import { prisma } from "@/lib/db";

const worker = globalThis as typeof globalThis & { cartExpirationStarted?: boolean };

export function startCartExpirationWorker() {
  if (worker.cartExpirationStarted) return;
  worker.cartExpirationStarted = true;
  const sweep = async () => {
    try {
      await prisma.cartItem.deleteMany({ where: { createdAt: { lte: cartExpiryCutoff() } } });
    } catch (error) {
      console.error("Cart expiration cleanup failed", error);
    } finally {
      setTimeout(sweep, 1_000).unref();
    }
  };
  void sweep();
}
