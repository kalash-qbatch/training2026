import { z } from "zod";

export const ChatbotActionSchema = z.object({
  label: z.string().min(1),
  action: z.enum(["add_to_cart", "view_product", "view_cart", "compare"]),
  payload: z.record(z.string(), z.unknown()),
  disabled: z.boolean().default(false),
});

export type ChatbotAction = z.infer<typeof ChatbotActionSchema>;

export const ChatbotProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  currency: z.string().default("USD"),
  image: z.string().min(1),
  rating: z.number().min(0).max(5).default(4.5),
  in_stock: z.boolean(),
  short_description: z.string().default(""),
  category: z.string().optional(),
  brand: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  /** Live catalog variant id — required by /api/cart when product has specs */
  specificationId: z.string().optional(),
  actions: z.array(ChatbotActionSchema).default([]),
});

export type ChatbotProduct = z.infer<typeof ChatbotProductSchema>;

export const ChatbotResponseTypeSchema = z.enum([
  "small_talk",
  "products",
  "product_detail",
  "comparison",
  "cart",
  "policy",
  "clarification",
  "refusal",
  "error",
]);

export type ChatbotResponseType = z.infer<typeof ChatbotResponseTypeSchema>;

export const ChatbotResponseSchema = z.object({
  message: z.string().min(1),
  type: ChatbotResponseTypeSchema,
  products: z.array(ChatbotProductSchema).default([]),
  quick_replies: z.array(z.string()).optional(),
});

export type ChatbotResponse = z.infer<typeof ChatbotResponseSchema>;

export const ChatRequestInputSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export type ChatRequestInput = z.infer<typeof ChatRequestInputSchema>;

export type ChatbotIntent =
  | "small_talk"
  | "product_search"
  | "product_detail"
  | "compare_products"
  | "cart_action"
  | "order_policy"
  | "out_of_scope"
  | "unclear";

export interface CatalogVariant {
  color?: string;
  size?: string;
  sku?: string;
  stock: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  currency: string;
  stock: number;
  rating: number;
  description: string;
  image: string;
  variants?: CatalogVariant[];
  features?: string[];
}

export interface StorePolicyTopic {
  title: string;
  summary: string;
  details: string[];
}

export interface StorePoliciesData {
  shipping: StorePolicyTopic;
  returns: StorePolicyTopic;
  payment: StorePolicyTopic;
  warranty: StorePolicyTopic;
  support: StorePolicyTopic;
}
