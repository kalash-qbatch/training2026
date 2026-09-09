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
    const payload = buildInvoiceEmailPayload(
      {
        orderNumber: 4353452,
        orderId: "order-001",
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
        order_number: 4353452,
        order_id: "order-001",
        order_url: "https://shop.example.com/orders/4353452",
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
