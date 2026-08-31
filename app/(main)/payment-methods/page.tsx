import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ManagePaymentMethodsClient } from "@/components/features/payment-methods/ManagePaymentMethodsClient";
import { listCustomerPaymentMethods } from "@/lib/services/stripe";

export const metadata = {
  title: "Payment Methods — Bhai ka Store",
  description: "Manage your saved payment methods.",
};

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/payment-methods");
  }

  let savedPMs: Awaited<ReturnType<typeof listCustomerPaymentMethods>> = [];
  try {
    savedPMs = await listCustomerPaymentMethods(session.user.id);
  } catch {
    // Non-fatal
  }

  return <ManagePaymentMethodsClient initialPMs={savedPMs} />;
}
