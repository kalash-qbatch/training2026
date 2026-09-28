import rawProducts from "../data/products.json";
import type { CatalogItem, ChatbotProduct } from "../types";
import type { SearchProductsInput } from "./tool-schemas";

const catalogItems: CatalogItem[] = rawProducts as CatalogItem[];

export function mapCatalogToChatbotProduct(item: CatalogItem): ChatbotProduct {
  const inStock = item.stock > 0;
  return {
    id: item.id,
    name: item.name,
    price: Number(item.price),
    currency: item.currency || "USD",
    image: item.image,
    rating: item.rating,
    in_stock: inStock,
    stock: item.stock,
    category: item.category,
    brand: item.brand,
    short_description:
      item.description.length > 120 ? `${item.description.slice(0, 117)}...` : item.description,
    actions: [
      {
        label: inStock ? "Add to Cart" : "Out of Stock",
        action: "add_to_cart",
        payload: { product_id: item.id, quantity: 1 },
        disabled: !inStock,
      },
      {
        label: "View Details",
        action: "view_product",
        payload: { product_id: item.id },
        disabled: false,
      },
    ],
  };
}

const STOP_WORDS = new Set([
  "search",
  "for",
  "do",
  "you",
  "have",
  "me",
  "show",
  "find",
  "get",
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "with",
  "of",
  "about",
  "what",
  "which",
  "some",
  "please",
  "can",
  "look",
  "looking",
  "item",
  "items",
  "product",
  "products",
  "under",
  "below",
  "above",
  "over",
  "less",
  "more",
  "than",
  "dollar",
  "dollars",
  "bucks",
  "cost",
  "price",
]);

function tokenMatches(token: string, target: string): boolean {
  if (target.includes(token)) return true;
  if (token.endsWith("s") && token.length > 3 && target.includes(token.slice(0, -1))) return true;
  if (token.endsWith("es") && token.length > 4 && target.includes(token.slice(0, -2))) return true;
  if (target.includes(token + "s") || target.includes(token + "es")) return true;
  return false;
}

/**
 * Searches the catalog with structured filters and keyword relevance matching.
 */
export async function searchProducts(params: SearchProductsInput): Promise<{
  totalMatches: number;
  products: ChatbotProduct[];
  alternativeSuggestions?: ChatbotProduct[];
}> {
  const rawTokens = (params.query || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));

  const filteredTokens = rawTokens.filter((token) => !STOP_WORDS.has(token));
  const effectiveTokens = filteredTokens.length > 0 ? filteredTokens : rawTokens;

  const filtered = catalogItems.filter((item) => {
    // Category filter
    if (params.category && !item.category.toLowerCase().includes(params.category.toLowerCase())) {
      return false;
    }

    // Brand filter
    if (params.brand && !item.brand.toLowerCase().includes(params.brand.toLowerCase())) {
      return false;
    }

    // Min price filter
    if (params.min_price !== undefined && item.price < params.min_price) {
      return false;
    }

    // Max price filter
    if (params.max_price !== undefined && item.price > params.max_price) {
      return false;
    }

    // In stock filter
    if (params.in_stock_only && item.stock <= 0) {
      return false;
    }

    // Keyword matching if query provided
    if (effectiveTokens.length > 0) {
      const searchTarget = [
        item.name,
        item.category,
        item.brand,
        item.description,
        ...(item.features || []),
      ]
        .join(" ")
        .toLowerCase();

      const matchedTokens = effectiveTokens.filter((token) => tokenMatches(token, searchTarget));
      // For multi-word queries, require at least 50% (or all if <= 2) to prevent false positives on fictional queries
      const minRequired = effectiveTokens.length <= 2 ? 1 : Math.ceil(effectiveTokens.length * 0.5);
      if (matchedTokens.length < minRequired) return false;
    }

    return true;
  });

  // Calculate relevance score
  const scored = filtered.map((item) => {
    let score = 0;
    const nameLower = item.name.toLowerCase();
    const descLower = item.description.toLowerCase();

    for (const token of effectiveTokens) {
      if (tokenMatches(token, nameLower)) score += 5;
      if (tokenMatches(token, descLower)) score += 2;
      if (tokenMatches(token, item.category.toLowerCase())) score += 3;
      if (tokenMatches(token, item.brand.toLowerCase())) score += 3;
    }

    return { item, score };
  });

  // Sorting
  if (params.sort === "price_asc") {
    scored.sort((a, b) => a.item.price - b.item.price);
  } else if (params.sort === "price_desc") {
    scored.sort((a, b) => b.item.price - a.item.price);
  } else if (params.sort === "rating_desc") {
    scored.sort((a, b) => b.item.rating - a.item.rating);
  } else {
    // Default relevance + rating
    scored.sort((a, b) => b.score - a.score || b.item.rating - a.item.rating);
  }

  const limit = Math.min(Math.max(params.limit || 5, 1), 5);
  const sliced = scored.slice(0, limit).map((s) => mapCatalogToChatbotProduct(s.item));

  // If results contain out of stock items, find in-stock alternatives
  let alternativeSuggestions: ChatbotProduct[] | undefined;
  const hasOutOfStock = sliced.some((p) => !p.in_stock);
  if (hasOutOfStock && sliced.length > 0) {
    const category = sliced[0].category;
    let alternatives = catalogItems
      .filter((i) => i.stock > 0 && i.category === category && !sliced.some((s) => s.id === i.id))
      .slice(0, 2)
      .map(mapCatalogToChatbotProduct);

    // If none left in same category, suggest top rated in-stock alternatives from catalog
    if (alternatives.length === 0) {
      alternatives = catalogItems
        .filter((i) => i.stock > 0 && !sliced.some((s) => s.id === i.id))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 2)
        .map(mapCatalogToChatbotProduct);
    }

    if (alternatives.length > 0) {
      alternativeSuggestions = alternatives;
    }
  }

  return {
    totalMatches: scored.length,
    products: sliced,
    alternativeSuggestions,
  };
}

/**
 * Retrieves exact product details by ID.
 */
export async function getProduct(productId: string): Promise<ChatbotProduct | null> {
  const item = catalogItems.find((i) => i.id === productId.trim());
  if (!item) return null;
  return mapCatalogToChatbotProduct(item);
}

/**
 * Compares two or more products side by side.
 */
export async function compareProducts(productIds: string[]): Promise<ChatbotProduct[]> {
  const products: ChatbotProduct[] = [];
  for (const id of productIds) {
    const p = await getProduct(id);
    if (p) products.push(p);
  }
  return products;
}

export function getAllCatalogProducts(): CatalogItem[] {
  return [...catalogItems];
}
