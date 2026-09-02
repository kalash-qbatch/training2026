import { mapOrder } from "@/lib/mappers";

describe("mapOrder — payment status for delivered orders", () => {
  const baseRow = {
    id: "order-001",
    orderNumber: 4353452,
    userId: "user-001",
    createdAt: new Date("2026-08-28T10:00:00.000Z"),
    subTotal: 59.98,
    tax: 4.8,
    total: 64.78,
    user: { fullName: "Jane Doe", name: "Jane Doe", email: "jane@example.com" },
    items: [],
  };

  it("shows SUCCEEDED for delivered COD orders still marked PENDING in DB", () => {
    const order = mapOrder({
      ...baseRow,
      status: "DELIVERED",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
    } as never);

    expect(order.status).toBe("delivered");
    expect(order.orderNumber).toBe(4353452);
    expect(order.paymentStatus).toBe("SUCCEEDED");
  });

  it("keeps REFUNDED payment status for delivered orders", () => {
    const order = mapOrder({
      ...baseRow,
      status: "DELIVERED",
      paymentMethod: "CARD",
      paymentStatus: "REFUNDED",
    } as never);

    expect(order.paymentStatus).toBe("REFUNDED");
  });
});
