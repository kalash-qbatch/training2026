import type { UserInfo } from "@/types";

export type InvoiceEmailDetails = {
  orderNumber: number;
  orderId: string;
  name: string;
  subTotal: number;
  tax: number;
  total: number;
  paymentMethod: "CARD" | "COD";
  paymentStatus: string;
  orderStatus: string;
  items: Array<{
    title: string;
    imageUrl: string;
    quantity: number;
    unitPrice: number;
    color?: string;
    size?: string;
  }>;
  shipping?: UserInfo;
};

function money(value: number): string {
  return value.toFixed(2);
}

export function selectInvoiceProductImage(
  product: {
    image: string;
    images: Array<{ url: string; color?: string | null }>;
  },
  selectedColor?: string
): string {
  const color = selectedColor?.trim().toLowerCase();

  return (
    product.images.find((image) => Boolean(color) && image.color?.trim().toLowerCase() === color)
      ?.url ??
    product.images.find((image) => !image.color?.trim())?.url ??
    product.images[0]?.url ??
    product.image
  );
}

export function buildInvoiceEmailPayload(
  details: InvoiceEmailDetails,
  appBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
) {
  const baseUrl = appBaseUrl.replace(/\/+$/, "");

  return {
    order_number: details.orderNumber,
    order_id: details.orderId,
    order_url: `${baseUrl}/orders/${encodeURIComponent(String(details.orderNumber))}`,
    subtotal: money(details.subTotal),
    tax: money(details.tax),
    total: money(details.total),
    name: details.name,
    payment_method: details.paymentMethod,
    payment_status: details.paymentStatus,
    order_status: details.orderStatus,
    items: details.items.map((item) => ({
      title: item.title,
      image_url: item.imageUrl,
      quantity: item.quantity,
      unit_price: money(item.unitPrice),
      line_total: money(item.unitPrice * item.quantity),
      color: item.color,
      size: item.size,
    })),
    shipping: details.shipping,
    subject: `Invoice & Confirmation for Order #${details.orderNumber}`,
  };
}
