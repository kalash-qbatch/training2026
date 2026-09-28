const STORE_TOPIC =
  /\b(product|products|price|prices|stock|size|sizes|color|colors|buy|cart|order|orders|shipping|tracking|status|store|catalog|watch|watches|shirt|shirts|glass|glasses|headphone|headphones|under\s*\$|in\s*stock|out\s*of\s*stock|variant|sku|category|categories|recommend|available|inventory)\b/i;

const OFF_TOPIC =
  /\b(python|javascript|typescript|java\b|c\+\+|golang|rust\b|html|css|react native|code|coding|program|programming|script|function|algorithm|game|games|tutorial|homework|essay|poem|story|weather|recipe|recipes|politics|bitcoin|crypto|how\s+to\s+(create|build|make|write|code|install)|chatgpt|openai)\b/i;

const OFF_TOPIC_REFUSAL =
  "I can only help with Bhai ka Store products, shopping, and your order status — prices, sizes, colors, stock, recommendations, and order tracking. Ask me something about our catalog or your orders.";

/** Greetings / thanks / bye in English + common romanized Urdu/Hindi + a few other languages. */
const SMALL_TALK_RE =
  /^(hi|hii+|hello|hey|heyy+|hola|yo|sup|hiya|howdy|greetings|good\s*(morning|afternoon|evening|night)|assalamu?\s*alaikum|as[- ]?salam|salam|namaste|namaskar|bonjour|bonsoir|ciao|hallo|hola|merhaba|shalom|kya\s*haal|kaya\s*haal|kes[ae]\s*(ho|hai)|kaise\s*(ho|hain)|kya\s*ha+l|kaya\s*ha+l|sab\s*theek|theek\s*ho|how\s*(are|r)\s*(you|u)|what'?s\s*up|wassup|thank(?:s| you)|shukriya|shukria|dhanyava?d|bye|goodbye|see\s*ya|take\s*care|ok(?:ay)?|acha|theek\s*hai)[\s!.?]*$/i;

const SMALL_TALK_CONTAINS_RE =
  /\b(kya\s*haal|kaya\s*haal|kaya\s*ha+l|kya\s*ha+l|kes[ae]\s*ho|kaise\s*ho|assalam|namaste|how\s*are\s*you)\b/i;

function normalizeChatText(message: string): string {
  return message
    .toLowerCase()
    .replace(/([a-z\u0600-\u06ff])[;:|/\\,_-]+([a-z\u0600-\u06ff])/gi, "$1$2")
    .replace(/[;:|/\\]+/g, " ")
    .replace(/[^a-z0-9\u0600-\u06ff\u0750-\u077f\s']/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristic gate: clearly off-topic and not store-related → refuse without LLM digression.
 */
export function getOffTopicRefusal(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  if (OFF_TOPIC.test(text) && !STORE_TOPIC.test(text)) {
    return OFF_TOPIC_REFUSAL;
  }
  return null;
}

/**
 * Short greetings / small talk in any common language or romanized Urdu/Hindi.
 */
export function getSmallTalkReply(message: string): string | null {
  const normalized = normalizeChatText(message);
  if (!normalized || normalized.length > 80) return null;
  if (STORE_TOPIC.test(normalized) || OFF_TOPIC.test(normalized)) return null;

  const isSmallTalk =
    SMALL_TALK_RE.test(normalized) ||
    (normalized.split(" ").length <= 6 && SMALL_TALK_CONTAINS_RE.test(normalized));

  if (!isSmallTalk) return null;

  // Roman Urdu / Urdu-script lean reply when the user wrote that way
  if (
    /\b(kya|kaya|kes[ae]|kaise|assalam|salam|namaste|shukriya|acha|theek)\b/i.test(normalized) ||
    /[\u0600-\u06FF]/.test(message)
  ) {
    return "Walaikum assalam — main theek hoon, shukriya! Main Bhai ka Store ka shopping assistant hoon. Products, prices, stock, ya apne orders ke baare mein poochhein — kisi bhi language mein okay hai.";
  }

  return "Hello! I'm doing well — thanks for asking. I'm the Bhai ka Store shopping assistant. Ask me about products, prices, stock, or your orders — in any language.";
}

export { OFF_TOPIC_REFUSAL };
