import "dotenv/config";

import Groq from "groq-sdk";

export const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";
export const GROQ_CHAT_FALLBACK_MODEL = "llama-3.3-70b-versatile";

let groqClientInstance: Groq | null = null;

function sanitizeHistory(history: { role: "user" | "assistant"; content: string }[]) {
  return history
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-6);
}

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY environment variable. Please add your free GROQ_API_KEY to your .env file."
    );
  }

  if (!groqClientInstance) {
    // Handle CJS/ESM interop where default export may be nested
    const GroqCtor = (Groq as unknown as { default?: typeof Groq }).default ?? Groq;
    groqClientInstance = new GroqCtor({ apiKey });
  }

  if (!groqClientInstance?.chat?.completions?.create) {
    groqClientInstance = null;
    throw new Error("Groq client failed to initialize chat.completions API");
  }

  return groqClientInstance;
}

/**
 * Rewrites a follow-up (or non-English) query into a standalone English product search query.
 */
export async function rewriteFollowupQuery(
  userQuery: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  const recentHistory = sanitizeHistory(history || []);

  try {
    const groq = getGroqClient();

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a search query reformulation assistant for an e-commerce store catalog.
Your job is to rewrite the customer's question into a single, self-contained ENGLISH product search query.
- Do NOT answer the question.
- Users may write in any language or romanized Urdu/Hindi/Arabic — translate shopping intent into clear English product terms (e.g. "kala watch dikhao" → "black watch").
- Resolve pronouns from history into concrete product terms.
- If the message is ONLY a greeting or small talk (any language), return exactly: SMALL_TALK
- If clearly unrelated to shopping/products/orders, return exactly: OFF_TOPIC
- Otherwise return ONLY the rewritten English search query text, with no quotes or preamble.
- If already a clear English product query, return it unchanged.
- ALWAYS keep price intent words when present: cheapest, lowest price, most expensive, high range, high-end, low-end, premium, luxury, budget, under $N, sort by price.
- Map natural phrases: "high range products" → "most expensive products"; "low range" / "budget" → "cheapest products".
- Example: "show me the lowest price product" → "lowest price products in the store"
- Example: "i want to know the high range of products" → "most expensive products"`,
        },
        ...recentHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user",
          content: userQuery,
        },
      ],
    });

    const rewritten = completion.choices[0]?.message?.content?.trim();
    return rewritten && rewritten.length > 0 ? rewritten : userQuery;
  } catch (error) {
    console.warn("Failed to rewrite query with Groq, falling back to original query:", error);
    return userQuery;
  }
}

/**
 * Generates a streaming chat response using Groq.
 */
export async function streamChatWithGroq(
  systemInstruction: string,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string
) {
  const groq = getGroqClient();
  const cappedHistory = sanitizeHistory(history);

  const messages = [
    { role: "system" as const, content: systemInstruction },
    ...cappedHistory.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    return await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      temperature: 0.1,
      stream: true,
      messages,
    });
  } catch (primaryError) {
    console.warn(
      `[Groq] Primary model ${GROQ_CHAT_MODEL} failed, trying fallback:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    return await groq.chat.completions.create({
      model: GROQ_CHAT_FALLBACK_MODEL,
      temperature: 0.1,
      stream: true,
      messages,
    });
  }
}
