import type { Order } from "@/types";

export const mockOrder: Order = {
  id: "order-001",
  orderNumber: 4_353_452,
  orderRef: "#4353452",
  date: "2026-08-28T10:00:00.000Z",
  userId: "user-test-001",
  userName: "Jane Doe",
  userEmail: "jane@example.com",
  amount: 64.78,
  subTotal: 59.98,
  tax: 4.8,
  status: "pending",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  items: [
    {
      productId: "prod-001",
      title: "Classic Tee",
      imageUrl: "/products/tee.jpg",
      price: 29.99,
      qty: 2,
      color: "black",
      size: "M",
    },
  ],
};

export const mockPaginatedOrders = {
  orders: [mockOrder],
  total: 1,
  page: 1,
  pageSize: 5,
  totalPages: 1,
};

export const validPlaceOrderPayload = {
  items: [
    {
      productId: "prod-001",
      quantity: 1,
      color: "black",
      size: "M",
    },
  ],
};
