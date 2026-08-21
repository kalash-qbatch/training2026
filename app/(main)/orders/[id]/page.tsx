import type { Metadata } from "next";

import { UserOrderDetailClient } from "@/components/features/orders/UserOrderDetailClient";

export const metadata: Metadata = {
  title: "Order Detail | Fullstack Store",
  description: "View order breakdown and items",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserOrderDetailClient orderId={id} />;
}
