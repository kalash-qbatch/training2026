import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createEmbedding } from "@/lib/ai/embeddings";
import { rewriteFollowupQuery, streamChatWithGroq } from "@/lib/ai/groq";
import { getOffTopicRefusal } from "@/lib/ai/store-topic";
import { prisma } from "@/lib/db";
import {
  buildRagPromptContext,
  type RetrievedProduct,
  searchSimilarProducts,
  SYSTEM_RAG_PROMPT,
} from "@/lib/services/rag";

export const dynamic = "force-dynamic";

const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  sessionId: z.string().uuid().optional().nullable(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

function titleFromMessage(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 48) return cleaned || "New Chat";
  return `${cleaned.slice(0, 45)}...`;
}

/** Persist via SQL so we never depend on Prisma model delegates for chat. */
async function persistUserTurn(
  userId: string,
  message: string,
  sessionId: string | null | undefined
): Promise<string | null> {
  try {
    let activeSessionId: string | null = null;

    if (sessionId) {
      const owned = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ChatSession"
        WHERE id = ${sessionId} AND "userId" = ${userId}
        LIMIT 1
      `;
      if (owned[0]?.id) activeSessionId = owned[0].id;
    }

    if (!activeSessionId) {
      activeSessionId = randomUUID();
      const title = titleFromMessage(message);
      await prisma.$executeRaw`
        INSERT INTO "ChatSession" (id, "userId", title, "createdAt", "updatedAt")
        VALUES (${activeSessionId}, ${userId}, ${title}, NOW(), NOW())
      `;
    }

    const messageId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ChatMessage" (id, "sessionId", role, content, "createdAt")
      VALUES (${messageId}, ${activeSessionId}, ${"user"}, ${message}, NOW())
    `;

    return activeSessionId;
  } catch (error) {
    console.error("Failed to persist user chat turn:", error);
    return null;
  }
}

async function persistAssistantTurn(
  sessionId: string,
  content: string,
  products: RetrievedProduct[],
  shouldUpdateTitle: boolean,
  titleSource: string
) {
  try {
    const messageId = randomUUID();
    const metadata = JSON.stringify({ products });
    await prisma.$executeRaw`
      INSERT INTO "ChatMessage" (id, "sessionId", role, content, metadata, "createdAt")
      VALUES (${messageId}, ${sessionId}, ${"assistant"}, ${content}, ${metadata}::jsonb, NOW())
    `;

    if (shouldUpdateTitle) {
      const title = titleFromMessage(titleSource);
      await prisma.$executeRaw`
        UPDATE "ChatSession"
        SET title = ${title}, "updatedAt" = NOW()
        WHERE id = ${sessionId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "ChatSession" SET "updatedAt" = NOW() WHERE id = ${sessionId}
      `;
    }
  } catch (error) {
    console.error("Failed to persist assistant chat turn:", error);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = ChatRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { message, history, sessionId } = parsed.data;
    const authSession = await auth();
    const userId = authSession?.user?.id ?? null;

    const activeSessionId = userId ? await persistUserTurn(userId, message, sessionId) : null;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GROQ_API_KEY is not configured on the server. Please add your free GROQ_API_KEY to your .env file.",
        },
        { status: 500 }
      );
    }

    const cappedHistory = history
      .filter(
        (m, idx, arr) => !(idx === arr.length - 1 && m.role === "user" && m.content === message)
      )
      .slice(-6);

    const offTopicRefusal = getOffTopicRefusal(message);
    if (offTopicRefusal) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: metadata\ndata: ${JSON.stringify({
                  standaloneQuery: message,
                  products: [],
                  sessionId: activeSessionId,
                })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: offTopicRefusal })}\n\n`)
            );
            if (userId && activeSessionId) {
              await persistAssistantTurn(
                activeSessionId,
                offTopicRefusal,
                [],
                cappedHistory.length === 0,
                message
              );
            }
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`
              )
            );
            controller.close();
          } catch (streamError) {
            console.error("Off-topic stream error:", streamError);
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const standaloneQuery = await rewriteFollowupQuery(message, cappedHistory);
    const queryEmbedding = await createEmbedding(standaloneQuery);
    const retrievedProducts = await searchSimilarProducts(queryEmbedding, 5, 0.25, standaloneQuery);
    const contextText = buildRagPromptContext(retrievedProducts);

    const systemInstruction = `${SYSTEM_RAG_PROMPT}

=== RETRIEVED PRODUCT CONTEXT ===
${contextText}
=================================`;

    const completionStream = await streamChatWithGroq(systemInstruction, cappedHistory, message);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let accumulated = "";
        try {
          controller.enqueue(
            encoder.encode(
              `event: metadata\ndata: ${JSON.stringify({
                standaloneQuery,
                products: retrievedProducts,
                sessionId: activeSessionId,
              })}\n\n`
            )
          );

          for await (const chunk of completionStream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              accumulated += delta;
              controller.enqueue(
                encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`)
              );
            }
          }

          if (userId && activeSessionId && accumulated) {
            await persistAssistantTurn(
              activeSessionId,
              accumulated,
              retrievedProducts,
              cappedHistory.length === 0,
              message
            );
          }

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`
            )
          );
          controller.close();
        } catch (streamError) {
          console.error("Stream generation error:", streamError);
          const errorMsg =
            streamError instanceof Error ? streamError.message : "Error streaming response";
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
