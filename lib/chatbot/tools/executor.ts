import type { ChatbotProduct } from "../types";
import { addToCart, type ChatCartSummary, getCartSummary, removeFromCart } from "./cart-service";
import { compareProducts, getProduct, searchProducts } from "./catalog-service";
import { getStorePolicies } from "./policy-service";
import {
  AddToCartInputSchema,
  GetProductInputSchema,
  GetStorePoliciesInputSchema,
  RemoveFromCartInputSchema,
  SearchProductsInputSchema,
} from "./tool-schemas";

export type ToolExecutionResult =
  | {
      tool: "search_products";
      data: { products: ChatbotProduct[]; totalMatches: number; alternatives?: ChatbotProduct[] };
    }
  | { tool: "get_product"; data: { product: ChatbotProduct | null } }
  | { tool: "compare_products"; data: { products: ChatbotProduct[] } }
  | { tool: "add_to_cart"; data: { success: boolean; cart: ChatCartSummary; message: string } }
  | { tool: "remove_from_cart"; data: { success: boolean; cart: ChatCartSummary; message: string } }
  | { tool: "view_cart"; data: { cart: ChatCartSummary } }
  | { tool: "get_store_policies"; data: { topic: string; policy: unknown } }
  | { tool: "error"; error: string };

/**
 * Executes a tool by name with arguments and optional sessionId.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  sessionId = "default_session"
): Promise<ToolExecutionResult> {
  console.log(`[ShopBuddy:ToolExecutor] Executing ${toolName}:`, JSON.stringify(args));

  try {
    switch (toolName) {
      case "search_products": {
        const validated = SearchProductsInputSchema.parse(args);
        const result = await searchProducts(validated);
        return {
          tool: "search_products",
          data: {
            products: result.products,
            totalMatches: result.totalMatches,
            alternatives: result.alternativeSuggestions,
          },
        };
      }

      case "get_product": {
        const validated = GetProductInputSchema.parse(args);
        const product = await getProduct(validated.product_id);
        return {
          tool: "get_product",
          data: { product },
        };
      }

      case "compare_products": {
        const productIds = Array.isArray(args.product_ids)
          ? (args.product_ids as string[])
          : [String(args.product_id || "")];
        const products = await compareProducts(productIds.filter(Boolean));
        return {
          tool: "compare_products",
          data: { products },
        };
      }

      case "add_to_cart": {
        const validated = AddToCartInputSchema.parse(args);
        const result = await addToCart(
          sessionId,
          validated.product_id,
          validated.quantity,
          validated.variant
        );
        return {
          tool: "add_to_cart",
          data: {
            success: true,
            cart: result.cart,
            message: `Added ${validated.quantity}x ${result.added.name} to your cart.`,
          },
        };
      }

      case "remove_from_cart": {
        const validated = RemoveFromCartInputSchema.parse(args);
        const result = await removeFromCart(sessionId, validated.product_id);
        return {
          tool: "remove_from_cart",
          data: {
            success: result.removed,
            cart: result.cart,
            message: result.removed ? "Item removed from cart." : "Item was not found in cart.",
          },
        };
      }

      case "view_cart": {
        const cart = getCartSummary(sessionId);
        return {
          tool: "view_cart",
          data: { cart },
        };
      }

      case "get_store_policies": {
        const validated = GetStorePoliciesInputSchema.parse(args);
        const result = getStorePolicies(validated);
        return {
          tool: "get_store_policies",
          data: result,
        };
      }

      default:
        return {
          tool: "error",
          error: `Unrecognized tool name: "${toolName}"`,
        };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Tool execution failed";
    console.error(`[ShopBuddy:ToolExecutor] Error executing ${toolName}:`, errorMsg);
    return {
      tool: "error",
      error: errorMsg,
    };
  }
}
