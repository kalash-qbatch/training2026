import { OrdersPageClient } from "@/components/features/orders/OrdersPageClient";

export const metadata = {
  title: "My Orders | Bhai ka Store",
  description: "View and track your order history",
};

export default function OrdersPage() {
  return <OrdersPageClient />;
}
