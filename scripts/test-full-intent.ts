import { prisma } from "../lib/db";
import { attachPaymentIntentToOrder, createOrder } from "../lib/services/orders";
import { createPaymentIntentForCart } from "../lib/services/stripe";

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  const simple = await prisma.product.findFirst({
    where: { isActive: true, stock: { gt: 0 }, specifications: { none: {} } },
    select: { id: true },
  });
  if (!user || !simple) return;

  const order = await createOrder(user.id, [{ productId: simple.id, quantity: 1 }], {
    paymentMethod: "CARD",
    paymentStatus: "PENDING",
  });
  const { clientSecret, paymentIntentId } = await createPaymentIntentForCart(
    user.id,
    Math.round(order.amount * 100),
    undefined,
    false,
    order.id
  );
  await attachPaymentIntentToOrder(order.id, user.id, paymentIntentId, clientSecret);
  console.log("Full flow OK");
}

main()
  .catch((e) => console.error("Full flow FAIL:", e))
  .finally(() => prisma.$disconnect());
