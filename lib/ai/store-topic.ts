const STORE_TOPIC =
  /\b(product|products|price|prices|stock|size|sizes|color|colors|buy|cart|order|shipping|store|catalog|watch|watches|shirt|shirts|glass|glasses|headphone|headphones|under\s*\$|in\s*stock|out\s*of\s*stock|variant|sku|category|categories|recommend|available|inventory)\b/i;

const OFF_TOPIC =
  /\b(python|javascript|typescript|java\b|c\+\+|golang|rust\b|html|css|react native|code|coding|program|programming|script|function|algorithm|game|games|tutorial|homework|essay|poem|story|weather|recipe|recipes|politics|bitcoin|crypto|how\s+to\s+(create|build|make|write|code|install)|chatgpt|openai)\b/i;

const OFF_TOPIC_REFUSAL =
  "I can only help with Bhai ka Store products and shopping — prices, sizes, colors, stock, and recommendations. Ask me something about our catalog.";

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

export { OFF_TOPIC_REFUSAL };
