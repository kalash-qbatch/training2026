export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startCartExpirationWorker } = await import("@/lib/services/cart-expiration-worker");
    startCartExpirationWorker();
  }
}
