import { CHATBOT_CONFIG } from "../config";
import { checkRateLimit } from "../security/rate-limiter";
import { isPromptInjection, sanitizeInput } from "../security/sanitizer";
import { executeTool } from "../tools/executor";
import {
  type ChatbotProduct,
  type ChatbotResponse,
  ChatbotResponseSchema,
  type ChatRequestInput,
} from "../types";
import { classifyIntent, extractSearchFilters } from "./intent-classifier";

function buildSafeFallback(message = CHATBOT_CONFIG.GENERIC_ERROR_FALLBACK): ChatbotResponse {
  return {
    message,
    type: "error",
    products: [],
    quick_replies: ["Search watches", "Best sellers", "Shipping policy"],
  };
}

/**
 * Validates the candidate response with Zod. If invalid, attempts one auto-correction,
 * and if still invalid returns a safe error response.
 */
function validateOrRepairResponse(candidate: unknown): ChatbotResponse {
  const initialParse = ChatbotResponseSchema.safeParse(candidate);
  if (initialParse.success) {
    return initialParse.data;
  }

  console.warn(
    "[ShopBuddy:Orchestrator] Schema validation failed. Attempting repair:",
    initialParse.error.issues
  );

  // Attempt repair
  if (typeof candidate === "object" && candidate !== null) {
    const raw = candidate as Record<string, unknown>;
    const repaired = {
      message:
        typeof raw.message === "string"
          ? raw.message.trim()
          : "Here are the details from our store.",
      type: typeof raw.type === "string" ? raw.type : "products",
      products: Array.isArray(raw.products) ? raw.products : [],
      quick_replies: Array.isArray(raw.quick_replies) ? raw.quick_replies : undefined,
    };
    const secondParse = ChatbotResponseSchema.safeParse(repaired);
    if (secondParse.success) {
      return secondParse.data;
    }
  }

  return buildSafeFallback();
}

/**
 * Main conversation orchestrator enforcing grounding, safety, typed tools, and schema validation.
 */
export async function processChatMessage(input: ChatRequestInput): Promise<ChatbotResponse> {
  const rawMessage = input.message || "";
  const sessionId = input.sessionId || "guest_session";

  // 1. Sanitize input & length check
  const message = sanitizeInput(rawMessage);

  // Handle empty or whitespace input
  if (!message || message.trim().length === 0) {
    return validateOrRepairResponse({
      message: "Please enter a question or search query so I can help you.",
      type: "clarification",
      products: [],
      quick_replies: ["Show all jackets", "Popular watches", "Store shipping info"],
    });
  }

  // 2. Prompt injection defense
  if (isPromptInjection(rawMessage) || isPromptInjection(message)) {
    console.warn(
      `[ShopBuddy:Security] Prompt injection blocked for session "${sessionId}":`,
      rawMessage
    );
    return validateOrRepairResponse({
      message:
        "I am ShopBuddy, the shopping assistant for ShopTrendz. I can only help you explore products, check policies, and manage your cart.",
      type: "refusal",
      products: [],
      quick_replies: ["What products do you have?", "View shipping policy", "Check my cart"],
    });
  }

  // 3. Rate limiting check
  const rateLimit = checkRateLimit(sessionId);
  if (!rateLimit.allowed) {
    return validateOrRepairResponse({
      message: "You are sending messages too quickly. Please pause for a moment and try again.",
      type: "error",
      products: [],
      quick_replies: ["Wait a moment"],
    });
  }

  // 4. Intent Classification
  const intent = classifyIntent(message);
  console.log(
    `[ShopBuddy:Orchestrator] Intent classified as "${intent}" for message: "${message}"`
  );

  try {
    switch (intent) {
      case "small_talk": {
        let reply =
          "Hello! I'm ShopBuddy, your personal shopping assistant. What are you looking to shop for today?";
        if (/how\s+are\s+you/i.test(message)) {
          reply = "I'm doing great, thank you! What are you shopping for today?";
        } else if (/thanks|thank\s+you/i.test(message)) {
          reply =
            "You're very welcome! Let me know if you need anything else for your shopping cart.";
        } else if (/bye|goodbye/i.test(message)) {
          reply = "Goodbye! Have a wonderful day and happy shopping!";
        } else if (/who\s+are\s+you|what\s+can\s+you\s+do/i.test(message)) {
          reply =
            "I'm ShopBuddy! I can help you search products, view specs, compare items, check your cart, and answer store policies.";
        }

        return validateOrRepairResponse({
          message: reply,
          type: "small_talk",
          products: [],
          quick_replies: ["Trending products", "Under $50 items", "Shipping policy"],
        });
      }

      case "out_of_scope": {
        return validateOrRepairResponse({
          message: CHATBOT_CONFIG.OFF_TOPIC_REFUSAL,
          type: "refusal",
          products: [],
          quick_replies: ["Show sneakers", "Explore electronics", "Bestselling watches"],
        });
      }

      case "unclear": {
        return validateOrRepairResponse({
          message: "Could you please specify what product or category you are looking for today?",
          type: "clarification",
          products: [],
          quick_replies: ["Show all categories", "Products under $50", "Store return policy"],
        });
      }

      case "order_policy": {
        let topic = "all";
        if (/\b(shipping|delivery|dispatch|arrive)\b/i.test(message)) topic = "shipping";
        else if (/\b(return|refund|exchange)\b/i.test(message)) topic = "returns";
        else if (/\b(payment|pay|card|stripe|apple|google)\b/i.test(message)) topic = "payment";
        else if (/\b(warranty|guarantee|damaged|defective)\b/i.test(message)) topic = "warranty";
        else if (/\b(contact|support|email|help)\b/i.test(message)) topic = "support";

        const toolRes = await executeTool("get_store_policies", { topic }, sessionId);
        if (toolRes.tool === "get_store_policies") {
          const pol = toolRes.data.policy as { title: string; summary: string };
          const policySummary = pol.summary || "Here is our official store policy.";
          return validateOrRepairResponse({
            message: `${policySummary} Feel free to ask if you have more questions!`,
            type: "policy",
            products: [],
            quick_replies: ["Shipping policy", "Returns & refunds", "Payment methods"],
          });
        }
        return buildSafeFallback();
      }

      case "cart_action": {
        if (/\b(view|show|check|what('?s|\s+is))\b/i.test(message)) {
          const toolRes = await executeTool("view_cart", {}, sessionId);
          if (toolRes.tool === "view_cart") {
            const { items, totalQuantity, formattedSubtotal } = toolRes.data.cart;
            if (totalQuantity === 0) {
              return validateOrRepairResponse({
                message:
                  "Your shopping cart is currently empty. Would you like to check out some popular items?",
                type: "cart",
                products: [],
                quick_replies: [
                  "Show popular watches",
                  "Under $50 apparel",
                  "Trending accessories",
                ],
              });
            }
            return validateOrRepairResponse({
              message: `You have ${totalQuantity} item(s) in your cart totaling ${formattedSubtotal}.`,
              type: "cart",
              products: [],
              quick_replies: ["Proceed to Checkout", "Clear cart", "Continue shopping"],
            });
          }
        } else if (/\b(remove|delete)\b/i.test(message)) {
          const prodIdMatch = message.match(/\bprod-[0-9]+\b/i);
          const productId = prodIdMatch ? prodIdMatch[0] : "";
          const toolRes = await executeTool(
            "remove_from_cart",
            { product_id: productId },
            sessionId
          );
          if (toolRes.tool === "remove_from_cart") {
            return validateOrRepairResponse({
              message: toolRes.data.message,
              type: "cart",
              products: [],
              quick_replies: ["View Cart", "Shop more products"],
            });
          }
        }
        // General cart fallback
        const toolRes = await executeTool("view_cart", {}, sessionId);
        if (toolRes.tool === "view_cart") {
          const { totalQuantity, formattedSubtotal } = toolRes.data.cart;
          return validateOrRepairResponse({
            message: `Your cart currently contains ${totalQuantity} items (${formattedSubtotal}).`,
            type: "cart",
            products: [],
            quick_replies: ["View Cart", "Checkout"],
          });
        }
        return buildSafeFallback();
      }

      case "product_detail": {
        // Look for ID like prod-001 or find by name keyword
        const idMatch = message.match(/\bprod-[0-9]+\b/i);
        let productId = idMatch ? idMatch[0] : "";

        if (!productId) {
          // Attempt to find by search first
          const searchFilters = extractSearchFilters(message);
          const searchRes = await executeTool(
            "search_products",
            { query: searchFilters.query, limit: 1 },
            sessionId
          );
          if (searchRes.tool === "search_products" && searchRes.data.products.length > 0) {
            productId = searchRes.data.products[0].id;
          }
        }

        if (!productId) {
          return validateOrRepairResponse({
            message:
              "I couldn't find that specific product in our store. Could you provide the product name or ID?",
            type: "product_detail",
            products: [],
            quick_replies: ["Browse all products", "Watches", "Sneakers"],
          });
        }

        const detailRes = await executeTool("get_product", { product_id: productId }, sessionId);
        if (detailRes.tool === "get_product" && detailRes.data.product) {
          const prod = detailRes.data.product;
          const stockMsg = prod.in_stock
            ? `In stock (${prod.stock} available)`
            : "Currently out of stock";
          const formattedPrice = `$${prod.price.toFixed(2)}`;

          return validateOrRepairResponse({
            message: `${prod.name} is priced at ${formattedPrice}. It is ${stockMsg} with a ${prod.rating}★ rating.`,
            type: "product_detail",
            products: [prod],
            quick_replies: prod.in_stock ? ["Add to Cart", "View cart"] : ["Find alternatives"],
          });
        }

        return validateOrRepairResponse({
          message: `Product ID "${productId}" was not found in our catalog.`,
          type: "product_detail",
          products: [],
          quick_replies: ["Search catalog", "Best sellers"],
        });
      }

      case "compare_products": {
        const idMatches = message.match(/\bprod-[0-9]+\b/gi) || [];
        let productIds = [...idMatches];

        if (productIds.length < 2) {
          // If not enough IDs, find from keywords
          const searchFilters = extractSearchFilters(message);
          const searchRes = await executeTool(
            "search_products",
            { query: searchFilters.query, limit: 2 },
            sessionId
          );
          if (searchRes.tool === "search_products") {
            productIds = searchRes.data.products.map((p) => p.id);
          }
        }

        if (productIds.length === 0) {
          return validateOrRepairResponse({
            message: "Please tell me which two products you'd like to compare.",
            type: "comparison",
            products: [],
            quick_replies: ["Compare watches", "Compare sneakers", "Compare hoodies"],
          });
        }

        const compRes = await executeTool(
          "compare_products",
          { product_ids: productIds },
          sessionId
        );
        if (compRes.tool === "compare_products") {
          const prods = compRes.data.products;
          if (prods.length === 0) {
            return validateOrRepairResponse({
              message: "I could not locate those products for comparison.",
              type: "comparison",
              products: [],
            });
          }

          const desc = prods
            .map(
              (p) =>
                `${p.name} ($${p.price.toFixed(2)}, rating: ${p.rating}★, ${p.in_stock ? "in stock" : "out of stock"})`
            )
            .join(" vs ");

          return validateOrRepairResponse({
            message: `Comparing: ${desc}.`,
            type: "comparison",
            products: prods,
            quick_replies: prods.map((p) => `Add ${p.name.slice(0, 15)}`),
          });
        }

        return buildSafeFallback();
      }

      case "product_search":
      default: {
        const filters = extractSearchFilters(message);
        const searchRes = await executeTool(
          "search_products",
          {
            query: filters.query,
            category: filters.category,
            min_price: filters.minPrice,
            max_price: filters.maxPrice,
            in_stock_only: filters.inStockOnly,
            limit: CHATBOT_CONFIG.MAX_RECOMMENDED_PRODUCTS,
          },
          sessionId
        );

        if (searchRes.tool === "search_products") {
          const { products, totalMatches, alternatives } = searchRes.data;

          if (products.length === 0) {
            return validateOrRepairResponse({
              message: CHATBOT_CONFIG.EMPTY_SEARCH_SUGGESTION,
              type: "products",
              products: [],
              quick_replies: ["Show all watches", "Show apparel", "Items under $50"],
            });
          }

          // Anti-hallucination check: If some products are out of stock, mention alternatives
          const outOfStock = products.filter((p) => !p.in_stock);
          let messageText = `Found ${totalMatches} item(s) matching your request. Here are our top recommendations:`;

          if (outOfStock.length > 0 && alternatives && alternatives.length > 0) {
            messageText = `Notice: Some items are out of stock. I've also highlighted in-stock alternatives from our catalog below!`;
          }

          const combinedProducts: ChatbotProduct[] = [...products];
          if (alternatives && alternatives.length > 0) {
            for (const alt of alternatives) {
              if (!combinedProducts.some((cp) => cp.id === alt.id) && combinedProducts.length < 5) {
                combinedProducts.push(alt);
              }
            }
          }

          return validateOrRepairResponse({
            message: messageText,
            type: "products",
            products: combinedProducts.slice(0, 5),
            quick_replies: combinedProducts
              .slice(0, 3)
              .map((p) => `Details on ${p.name.slice(0, 15)}`),
          });
        }

        return buildSafeFallback();
      }
    }
  } catch (error: unknown) {
    console.error("[ShopBuddy:Orchestrator] Error processing message:", error);
    return buildSafeFallback();
  }
}
