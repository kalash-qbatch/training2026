import { Suspense } from "react";

import { OrdersPageClient } from "@/components/features/orders/OrdersPageClient";
import { OrdersTableSkeleton } from "@/components/ui/skeletons/OrdersTableSkeleton";

export const metadata = {
  title: "My Orders | Bhai ka Store",
  description: "View and track your order history",
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersTableSkeleton />}>
      <OrdersPageClient />
    </Suspense>
  );
}
