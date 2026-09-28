import type { ChatbotIntent } from "../types";

const SMALL_TALK_PATTERNS = [
  /^(hi|hello|hey|hola|greetings|good\s+(morning|afternoon|evening)|yo)\b/i,
  /^how\s+are\s+you/i,
  /^(how'?s\s+it\s+going|how\s+do\s+you\s+do)/i,
  /^(thanks|thank\s+you|thx|cheers|much\s+appreciated)/i,
  /^(bye|goodbye|see\s+ya|catch\s+you\s+later|have\s+a\s+good\s+(one|day))/i,
  /^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|introduce\s+yourself)/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(write|create|code|debug)\s+(?:an?\s+)?(?:python|javascript|typescript|c\+\+|java|html|css|script|sql|code|program)\b/i,
  /\b(who\s+is|who\s+was)\s+(the\s+)?(president|prime\s+minister|king|queen|governor|pope)\b/i,
  /\b(what\s+is\s+the\s+capital|capital\s+of|weather\s+in|population\s+of)\b/i,
  /\b(quantum\s+physics|calculus|differential\s+equation|einstein|relativity)\b/i,
  /\b(medical\s+advice|symptoms\s+of|prescribe|diagnose|cure|medicine)\b/i,
  /\b(legal\s+advice|sue|lawsuit|lawyer|attorney|statute\s+of\s+limitations)\b/i,
  /\b(who\s+won\s+the\s+(world\s+cup|super\s+bowl|election|match))\b/i,
  /\b(meaning\s+of\s+life|tell\s+me\s+a\s+joke|write\s+a\s+poem|write\s+an\s+essay)\b/i,
];

const POLICY_PATTERNS = [
  /\b(shipping|delivery|deliver|dispatch|ship\s+to|courier|freight|how\s+long\s+to\s+arrive)\b/i,
  /\b(return|refund|exchange|money\s+back|return\s+policy|cancel\s+order)\b/i,
  /\b(payment|pay|credit\s+card|debit\s+card|stripe|apple\s+pay|google\s+pay|installments|klarna)\b/i,
  /\b(warranty|guarantee|damaged|defective|repair)\b/i,
  /\b(contact|support|phone\s+number|email\s+address|help\s+desk|customer\s+service)\b/i,
];

const CART_PATTERNS = [
  /\b(add\s+to\s+cart|put\s+in\s+(my\s+)?cart|buy\s+now)\b/i,
  /\b(view\s+cart|show\s+(my\s+)?cart|what('?s|\s+is)\s+in\s+my\s+cart|check\s+my\s+cart|cart\s+items)\b/i,
  /\b(remove\s+from\s+cart|delete\s+from\s+cart|clear\s+(my\s+)?cart)\b/i,
  /\b(proceed\s+to\s+checkout|checkout)\b/i,
];

const COMPARE_PATTERNS = [
  /\bcompare\b/i,
  /\b(difference\s+between|vs\.?|versus)\b/i,
  /\bwhich\s+is\s+better\b/i,
];

const PRODUCT_DETAIL_PATTERNS = [
  /\b(tell\s+me\s+more\s+about|details\s+(for|of|on)|specs\s+(for|of|on)|features\s+of)\b/i,
  /\bprod-[0-9]+\b/i,
  /\b(show\s+details|specification|what\s+material|battery\s+life\s+of)\b/i,
];

export interface ExtractedFilters {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
}

/**
 * Parses user message for natural price constraints like "under $50", "between 30 and 100", etc.
 */
export function extractSearchFilters(text: string): ExtractedFilters {
  let cleaned = text.trim();
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let inStockOnly: boolean | undefined;

  // "under $50", "below 100", "less than 75", "under 300"
  const underMatch = text.match(
    /\b(?:under|below|less\s+than|cheaper\s+than)\s*\$?(\d+(?:\.\d+)?)\b/i
  );
  if (underMatch) {
    maxPrice = parseFloat(underMatch[1]);
    cleaned = cleaned.replace(underMatch[0], " ");
  }

  // "over $50", "above 100", "more than 30"
  const overMatch = text.match(/\b(?:over|above|more\s+than)\s*\$?(\d+(?:\.\d+)?)\b/i);
  if (overMatch) {
    minPrice = parseFloat(overMatch[1]);
    cleaned = cleaned.replace(overMatch[0], " ");
  }

  // "between 30 and 80", "30 - 80 dollars"
  const betweenMatch = text.match(/\b(?:between\s*\$?)(\d+)\s*(?:and|-|to)\s*\$?(\d+)\b/i);
  if (betweenMatch) {
    minPrice = parseFloat(betweenMatch[1]);
    maxPrice = parseFloat(betweenMatch[2]);
    cleaned = cleaned.replace(betweenMatch[0], " ");
  }

  if (/\b(in\s+stock|available\s+now)\b/i.test(text)) {
    inStockOnly = true;
  }

  // Extract category hints
  let category: string | undefined;
  if (/\b(shirts?|tees?|t-shirts?|hoodies?|jackets?|clothing|apparel|leggings?)\b/i.test(text)) {
    category = "Apparel";
  } else if (/\b(watch|watches|timepieces?|smartwatch(?:es)?)\b/i.test(text)) {
    category = "Watches";
  } else if (/\b(bags?|backpacks?|totes?|crossbod(?:y|ies)|duffels?)\b/i.test(text)) {
    category = "Bags";
  } else if (/\b(shoes?|sneakers?|loafers?|footwear)\b/i.test(text)) {
    category = "Footwear";
  } else if (
    /\b(headphones?|earbuds?|speakers?|electronics?|chargers?|power\s*banks?|lamps?)\b/i.test(text)
  ) {
    category = "Electronics";
  } else if (
    /\b(sunglasses?|beanies?|scar(?:f|ves)|tumblers?|bottles?|wallets?|accessories)\b/i.test(text)
  ) {
    category = "Accessories";
  }

  return {
    query: cleaned,
    category,
    minPrice,
    maxPrice,
    inStockOnly,
  };
}

/**
 * Classifies customer input into one of the 8 required architectural intents.
 */
export function classifyIntent(message: string): ChatbotIntent {
  const trimmed = message.trim();

  // 1. Extreme short or ambiguous input -> unclear
  if (
    trimmed.length === 0 ||
    /^[^a-zA-Z0-9]+$/.test(trimmed) ||
    /^(help|thing|stuff|it|what)\??$/i.test(trimmed)
  ) {
    return "unclear";
  }

  // 2. Out of scope questions -> refusal
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "out_of_scope";
    }
  }

  // 3. Small talk
  for (const pattern of SMALL_TALK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "small_talk";
    }
  }

  // 4. Cart actions
  for (const pattern of CART_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "cart_action";
    }
  }

  // 5. Store policies
  for (const pattern of POLICY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "order_policy";
    }
  }

  // 6. Compare products
  for (const pattern of COMPARE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "compare_products";
    }
  }

  // 7. Product detail
  for (const pattern of PRODUCT_DETAIL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "product_detail";
    }
  }

  // 8. General shopping queries default to product search
  return "product_search";
}
