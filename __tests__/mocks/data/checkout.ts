import { mockOrder } from "@/__tests__/mocks/data/orders";
import type { UserInfo } from "@/types";

export const mockShippingInfo: UserInfo = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  phone: "+911234567890",
  address: "123 Main St",
  city: "Mumbai",
  postalCode: "400001",
};

export const mockCardOrder = {
  ...mockOrder,
  paymentMethod: "CARD" as const,
  paymentStatus: "PENDING" as const,
  stripePaymentIntentId: "pi_test_123",
};

/** Prisma row shape returned by findOrderByPaymentIntentId */
export const mockDbOrderRow = {
  id: mockOrder.id,
  userId: mockOrder.userId,
  orderNumber: mockOrder.orderNumber,
  stripePaymentIntentId: "pi_test_123",
  user: { fullName: "Jane Doe", name: "Jane Doe", email: "jane@example.com" },
  items: [],
};

export const mockPaymentIntent = {
  id: "pi_test_123",
  client_secret: "pi_test_123_secret",
  status: "succeeded",
  metadata: { userId: "user-test-001", orderId: "order-001" },
  last_payment_error: null,
};

export const mockStripeIntentResponse = {
  clientSecret: "pi_test_123_secret",
  paymentIntentId: "pi_test_123",
};
