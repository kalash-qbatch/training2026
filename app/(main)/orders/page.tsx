import type { Metadata } from "next";

import { UserOrdersPageClient } from "@/components/features/orders/UserOrdersPageClient";

export const metadata: Metadata = {
  title: "My Orders | Fullstack Store",
  description: "View and track your order history",
};

export default function OrdersPage() {
  return <UserOrdersPageClient />;
}
