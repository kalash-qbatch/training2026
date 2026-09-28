import Groq from "groq-sdk";
import OpenAI from "openai";

import { CHATBOT_CONFIG } from "../config";
import { CHATBOT_TOOL_DEFINITIONS } from "../tools/tool-schemas";

export interface ToolCallDecision {
  toolName: string;
  args: Record<string, unknown>;
}

export interface LLMChatResult {
  content: string | null;
  toolCalls?: ToolCallDecision[];
}

function getLLMClient(): { client: Groq | OpenAI; type: "groq" | "openai" } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      client: new Groq({ apiKey: process.env.GROQ_API_KEY }),
      type: "groq",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      type: "openai",
    };
  }
  return null;
}

/**
 * Executes chat completion with function calling, exponential backoff retries, and timeout.
 */
export async function callLLMWithTools(
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    tool_call_id?: string;
  }>,
  tools = CHATBOT_TOOL_DEFINITIONS
): Promise<LLMChatResult> {
  const provider = getLLMClient();
  if (!provider) {
    throw new Error("No LLM API key configured (neither GROQ_API_KEY nor OPENAI_API_KEY is set).");
  }

  const model = provider.type === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= CHATBOT_CONFIG.LLM_MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHATBOT_CONFIG.LLM_TIMEOUT_MS);

      let response: any;

      if (provider.type === "groq") {
        response = await (provider.client as Groq).chat.completions.create(
          {
            model,
            messages: messages as unknown as Groq.Chat.Completions.ChatCompletionMessageParam[],
            tools: tools as unknown as Groq.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto",
            temperature: 0.1,
          },
          { signal: controller.signal }
        );
      } else {
        response = await (provider.client as OpenAI).chat.completions.create(
          {
            model,
            messages: messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            tools: tools as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto",
            temperature: 0.1,
          },
          { signal: controller.signal }
        );
      }

      clearTimeout(timeoutId);

      const choice = response.choices[0]?.message;
      if (!choice) {
        throw new Error("Empty response from LLM provider");
      }

      const toolCalls: ToolCallDecision[] = (choice.tool_calls || []).map((tc: any) => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {
          parsedArgs = { query: tc.function.arguments };
        }
        return {
          toolName: tc.function.name,
          args: parsedArgs,
        };
      });

      return {
        content: choice.content ?? null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      attempt++;
      if (attempt <= CHATBOT_CONFIG.LLM_MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  throw lastError || new Error("Failed LLM call after retries");
}
