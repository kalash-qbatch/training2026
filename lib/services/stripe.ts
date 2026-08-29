import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

/**
 * Returns or creates a Stripe Customer for the given userId.
 * Saves stripeCustomerId back to the User record.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Lists all saved card payment methods for the user.
 */
export async function listCustomerPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) return [];

  const [pms, customer] = await Promise.all([
    stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    }),
    stripe.customers.retrieve(user.stripeCustomerId),
  ]);

  const defaultPmId =
    !customer.deleted && typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : null;

  return pms.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "unknown",
    last4: pm.card?.last4 ?? "****",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultPmId,
  }));
}

/**
 * Creates a SetupIntent to allow the user to add a new card without charging.
 */
export async function createCustomerSetupIntent(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const customerId = await getOrCreateStripeCustomer(
    userId,
    user.email,
    user.fullName || user.name || "Customer"
  );

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });

  return setupIntent.client_secret!;
}

/**
 * Sets the default payment method for a Stripe customer.
 */
export async function setDefaultCustomerPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer found");

  // Verify this PM belongs to our customer
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== user.stripeCustomerId) {
    throw new Error("Payment method does not belong to this customer");
  }

  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

/**
 * Detaches a payment method from the customer (deletes it).
 */
export async function deleteCustomerPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer found");

  // Verify this PM belongs to our customer before detaching
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== user.stripeCustomerId) {
    throw new Error("Payment method does not belong to this customer");
  }

  await stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Attaches a payment method to the customer (after SetupIntent success).
 */
export async function attachPaymentMethodToCustomer(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer found");

  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: user.stripeCustomerId,
  });
}

/**
 * Creates a Stripe PaymentIntent for checkout with the given items and optional saved PM.
 */
export async function createPaymentIntentForCart(
  userId: string,
  totalAmountCents: number,
  paymentMethodId?: string,
  savePaymentMethod?: boolean
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const customerId = await getOrCreateStripeCustomer(
    userId,
    user.email,
    user.fullName || user.name || "Customer"
  );

  const intentData: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: totalAmountCents,
    currency: "usd",
    customer: customerId,
    setup_future_usage: savePaymentMethod ? "off_session" : undefined,
    payment_method_types: ["card"],
    metadata: { userId },
  };

  if (paymentMethodId) {
    intentData.payment_method = paymentMethodId;
  }

  const intent = await stripe.paymentIntents.create(intentData);

  return {
    clientSecret: intent.client_secret!,
    paymentIntentId: intent.id,
  };
}
