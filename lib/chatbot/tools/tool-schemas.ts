import { z } from "zod";

export const SearchProductsInputSchema = z.object({
  query: z.string().describe("Search keywords, product names, or descriptive features"),
  category: z
    .string()
    .optional()
    .describe(
      "Optional product category filter (e.g., Apparel, Watches, Bags, Footwear, Electronics, Accessories)"
    ),
  min_price: z.number().nonnegative().optional().describe("Minimum price in USD"),
  max_price: z.number().nonnegative().optional().describe("Maximum price in USD"),
  brand: z.string().optional().describe("Brand name filter"),
  in_stock_only: z.boolean().optional().describe("Whether to only return items currently in stock"),
  sort: z
    .enum(["price_asc", "price_desc", "rating_desc", "relevance"])
    .optional()
    .describe("Sorting strategy"),
  limit: z.number().int().min(1).max(5).optional().describe("Max products to return (<= 5)"),
});

export type SearchProductsInput = z.infer<typeof SearchProductsInputSchema>;

export const GetProductInputSchema = z.object({
  product_id: z.string().describe("The unique product ID"),
});

export type GetProductInput = z.infer<typeof GetProductInputSchema>;

export const AddToCartInputSchema = z.object({
  product_id: z.string().describe("The product ID to add"),
  quantity: z.number().int().min(1).default(1).describe("Quantity to add"),
  variant: z.string().optional().describe("Optional color/size variant or SKU"),
});

export type AddToCartInput = z.infer<typeof AddToCartInputSchema>;

export const RemoveFromCartInputSchema = z.object({
  product_id: z.string().describe("The product ID to remove"),
});

export type RemoveFromCartInput = z.infer<typeof RemoveFromCartInputSchema>;

export const ViewCartInputSchema = z.object({});

export type ViewCartInput = z.infer<typeof ViewCartInputSchema>;

export const GetStorePoliciesInputSchema = z.object({
  topic: z
    .enum(["shipping", "returns", "payment", "warranty", "support", "all"])
    .describe("Policy topic to retrieve"),
});

export type GetStorePoliciesInput = z.infer<typeof GetStorePoliciesInputSchema>;

/**
 * OpenAI / Groq Compatible Tool Definitions for function calling
 */
export const CHATBOT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description:
        "Search the store product catalog by keywords, category, price range, brand, and stock status. Returns up to 5 verified products.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search terms or description" },
          category: {
            type: "string",
            description:
              "Category filter (Apparel, Watches, Bags, Footwear, Electronics, Accessories)",
          },
          min_price: { type: "number", description: "Minimum price in USD" },
          max_price: { type: "number", description: "Maximum price in USD" },
          brand: { type: "string", description: "Brand filter" },
          in_stock_only: { type: "boolean", description: "Only return in-stock items" },
          sort: {
            type: "string",
            enum: ["price_asc", "price_desc", "rating_desc", "relevance"],
            description: "Sort order",
          },
          limit: { type: "integer", minimum: 1, maximum: 5, description: "Max results (up to 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product",
      description:
        "Get verified live details, exact price, specs, variants, and stock for a specific product ID.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Product unique identifier" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_cart",
      description: "Add an item with quantity and optional variant to the customer's cart.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Product ID to add" },
          quantity: { type: "integer", minimum: 1, default: 1, description: "Number of units" },
          variant: { type: "string", description: "Color, size, or SKU variant" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remove_from_cart",
      description: "Remove an item completely from the customer's cart by product ID.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Product ID to remove" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "view_cart",
      description:
        "Retrieve all items currently in the customer's cart along with line totals and count.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_store_policies",
      description:
        "Look up official store policies regarding shipping, returns & refunds, payment methods, warranty, and customer support.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["shipping", "returns", "payment", "warranty", "support", "all"],
            description: "The specific policy topic",
          },
        },
        required: ["topic"],
      },
    },
  },
];
