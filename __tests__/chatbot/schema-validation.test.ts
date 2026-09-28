import {
  ChatbotActionSchema,
  ChatbotProductSchema,
  ChatbotResponseSchema,
} from "@/lib/chatbot/types";

describe("Schema Validation Suite", () => {
  it("successfully parses valid ChatbotResponse", () => {
    const sample = {
      message: "Here are some watches you might like!",
      type: "products",
      products: [
        {
          id: "prod-008",
          name: "Minimalist Sapphire Stainless Watch",
          price: 150.0,
          currency: "USD",
          image: "/products/watch.jpg",
          rating: 4.9,
          in_stock: true,
          short_description: "Sleek 40mm quartz timepiece.",
          actions: [
            {
              label: "Add to Cart",
              action: "add_to_cart",
              payload: { product_id: "prod-008", quantity: 1 },
              disabled: false,
            },
          ],
        },
      ],
      quick_replies: ["View Cart", "More watches"],
    };

    const parsed = ChatbotResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("products");
      expect(parsed.data.products).toHaveLength(1);
    }
  });

  it("rejects responses missing required 'message' or 'type'", () => {
    const invalid1 = { products: [] };
    const invalid2 = { message: "Hello", type: "invalid_type_name" };

    expect(ChatbotResponseSchema.safeParse(invalid1).success).toBe(false);
    expect(ChatbotResponseSchema.safeParse(invalid2).success).toBe(false);
  });

  it("validates ProductCard action schema", () => {
    const validAction = {
      label: "Add to Cart",
      action: "add_to_cart",
      payload: { product_id: "prod-001", quantity: 1 },
      disabled: false,
    };
    expect(ChatbotActionSchema.safeParse(validAction).success).toBe(true);

    const invalidAction = {
      label: "Click Me",
      action: "unsupported_action",
      payload: {},
    };
    expect(ChatbotActionSchema.safeParse(invalidAction).success).toBe(false);
  });

  it("validates product schema and rejects negative price", () => {
    const invalidProduct = {
      id: "prod-bad",
      name: "Bad Product",
      price: -10, // Invalid negative price
      currency: "USD",
      image: "/products/tee.jpg",
      in_stock: true,
    };
    expect(ChatbotProductSchema.safeParse(invalidProduct).success).toBe(false);
  });
});
