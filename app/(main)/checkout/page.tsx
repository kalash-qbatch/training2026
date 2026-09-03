import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CheckoutPageClient } from "@/components/features/checkout/CheckoutPageClient";
import { findLatestShippingForUser, findOrderById } from "@/lib/services/orders";
import { listCustomerPaymentMethods } from "@/lib/services/stripe";
import type { UserInfo } from "@/types";

export const metadata = {
  title: "Checkout — Bhai ka Store",
  description: "Complete your purchase securely.",
};

type Props = {
  searchParams: Promise<{ orderId?: string }>;
};

export default async function CheckoutPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/checkout");
  }

  const userId = session.user.id;
  const { orderId } = await searchParams;

  let savedPMs: Awaited<ReturnType<typeof listCustomerPaymentMethods>> = [];
  try {
    savedPMs = await listCustomerPaymentMethods(userId);
  } catch {
    // Non-fatal: user just won't see saved cards
  }

  let retryOrder = null;
  if (orderId) {
    retryOrder = await findOrderById(orderId, userId);
    if (
      !retryOrder ||
      retryOrder.status === "cancelled" ||
      retryOrder.paymentStatus === "SUCCEEDED" ||
      retryOrder.paymentStatus === "PAID"
    ) {
      redirect("/orders");
    }
  }

  let savedShipping: UserInfo | null = null;
  if (!retryOrder) {
    try {
      savedShipping = await findLatestShippingForUser(userId);
    } catch {
      savedShipping = null;
    }
  }

  return (
    <CheckoutPageClient
      savedPMs={savedPMs}
      selectedItems={[]}
      retryOrder={retryOrder}
      savedShipping={savedShipping}
    />
  );
}
