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

describe("mapOrder — variation images", () => {
  const mapImage = (color: string, images?: { url: string; color: string; sortOrder: number }[]) =>
    mapOrder({
      id: "order-001",
      createdAt: new Date("2026-09-08"),
      status: "PENDING",
      user: { fullName: "Jane Doe" },
      items: [
        {
          productId: "cap",
          color,
          quantity: 1,
          price: 23,
          product: { title: "Cap", image: "/cap.jpg", images },
        },
      ],
    } as never).items[0].imageUrl;

  it("uses the first image for the ordered color, ignoring case and whitespace", () => {
    expect(
      mapImage(" Green ", [
        { url: "/blue.jpg", color: "Blue", sortOrder: 0 },
        { url: "/green-back.jpg", color: "Green", sortOrder: 2 },
        { url: "/green.jpg", color: "green", sortOrder: 1 },
      ])
    ).toBe("/green.jpg");
  });

  it("falls back to the main image when the variation has no image", () => {
    expect(mapImage("Green", [{ url: "/blue.jpg", color: "Blue", sortOrder: 0 }])).toBe("/cap.jpg");
    expect(mapImage("Green")).toBe("/cap.jpg");
    expect(mapImage("", [{ url: "/blue.jpg", color: "Blue", sortOrder: 0 }])).toBe("/cap.jpg");
  });
});
