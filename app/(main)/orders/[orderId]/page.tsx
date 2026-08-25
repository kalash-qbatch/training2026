import { OrderDetailClient } from "@/components/features/orders/OrderDetailClient";

export const metadata = {
  title: "Order Detail | Bhai ka Store",
  description: "View details of your order",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderDetailClient orderId={orderId} />;
}
