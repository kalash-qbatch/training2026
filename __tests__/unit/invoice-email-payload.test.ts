import { buildInvoiceEmailPayload, selectInvoiceProductImage } from "@/lib/email-payloads";

describe("invoice email payload", () => {
  it("uses the image matching the selected product color", () => {
    const image = selectInvoiceProductImage(
      {
        image: "https://cdn.example.com/default.jpg",
        images: [
          { url: "https://cdn.example.com/orange.jpg", color: "Orange" },
          { url: "https://cdn.example.com/green.jpg", color: "Green" },
        ],
      },
      " green "
    );

    expect(image).toBe("https://cdn.example.com/green.jpg");
  });

  it("includes products, variants, images, totals, shipping, and the order URL", () => {
    const orderId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
    const payload = buildInvoiceEmailPayload(
      {
        orderId,
        name: "Jane Doe",
        subTotal: 59.98,
        tax: 4.8,
        total: 64.78,
        paymentMethod: "CARD",
        paymentStatus: "SUCCEEDED",
        orderStatus: "PROCESSING",
        items: [
          {
            title: "Classic Tee",
            imageUrl: "/products/tee.jpg",
            quantity: 2,
            unitPrice: 29.99,
            color: "Black",
            size: "M",
          },
        ],
        shipping: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          phone: "+1 555 0100",
          address: "12 Market Street",
          city: "New York",
          postalCode: "10001",
        },
      },
      "https://shop.example.com/"
    );

    expect(payload).toEqual(
      expect.objectContaining({
        order_number: orderId,
        order_id: orderId,
        order_url: `https://shop.example.com/orders/${encodeURIComponent(orderId)}`,
        subtotal: "59.98",
        tax: "4.80",
        total: "64.78",
        payment_method: "CARD",
        payment_status: "SUCCEEDED",
      })
    );
    expect(payload.items).toEqual([
      expect.objectContaining({
        title: "Classic Tee",
        image_url: "/products/tee.jpg",
        quantity: 2,
        unit_price: "29.99",
        line_total: "59.98",
        color: "Black",
        size: "M",
      }),
    ]);
    expect(payload.shipping).toEqual(expect.objectContaining({ postalCode: "10001" }));
  });
});
