import { CHATBOT_CONFIG } from "../config";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|(?:developer\s+)?instructions|developer\s+mode)/i,
  /show\s+(me\s+)?(your\s+)?(system\s+prompt|hidden\s+prompt|(?:developer\s+)?instructions)/i,
  /what\s+is\s+your\s+(?:hidden\s+)?(?:system\s+prompt|(?:developer\s+)?instructions)/i,
  /print\s+(your\s+)?(?:developer\s+)?(?:system\s+prompt|instructions)/i,
  /you\s+are\s+now\s+(DAN|unfiltered|jailbroken|developer\s+mode)/i,
  /act\s+as\s+(an\s+unfiltered|DAN|jailbroken)/i,
  /pretend\s+you\s+have\s+no\s+(rules|restrictions)/i,
  /bypass\s+(all\s+)?(safety|filters|rules)/i,
];

/**
 * Strips HTML tags, script blocks, and null bytes to prevent XSS / injection.
 */
export function sanitizeInput(rawText: string): string {
  if (!rawText) return "";

  // Truncate to maximum configured length
  let cleaned = rawText.slice(0, CHATBOT_CONFIG.MAX_MESSAGE_INPUT_LENGTH);

  // Remove control and null bytes
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Strip script, style, and HTML tags
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, " ");

  // Normalize excessive whitespaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Checks if the user message contains malicious jailbreak or prompt extraction attempts.
 */
export function isPromptInjection(text: string): boolean {
  if (!text) return false;
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
