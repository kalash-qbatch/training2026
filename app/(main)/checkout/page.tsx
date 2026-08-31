import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CheckoutPageClient } from "@/components/features/checkout/CheckoutPageClient";
import { listCustomerPaymentMethods } from "@/lib/services/stripe";

export const metadata = {
  title: "Checkout — Bhai ka Store",
  description: "Complete your purchase securely.",
};

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/checkout");
  }

  // Fetch user's saved payment methods from Stripe
  let savedPMs: Awaited<ReturnType<typeof listCustomerPaymentMethods>> = [];
  try {
    savedPMs = await listCustomerPaymentMethods(session.user.id);
  } catch {
    // Non-fatal: user just won't see saved cards
  }

  // Pass cart items from URL params or let client read from store
  // We render the client component which reads from Zustand cart store
  return <CheckoutPageClient savedPMs={savedPMs} selectedItems={[]} />;
}
