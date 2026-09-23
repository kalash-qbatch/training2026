import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminOffTopicRefusal, SYSTEM_ADMIN_PROMPT } from "@/lib/ai/admin-topic";
import { rewriteFollowupQuery, streamChatWithGroq } from "@/lib/ai/groq";
import { requireAdminUser } from "@/lib/controllers/http";
import { prisma } from "@/lib/db";
import { formatAdminStatsContext, getAdminDashboardStats } from "@/lib/services/admin-stats";

export const dynamic = "force-dynamic";

const ADMIN_SESSION_PREFIX = "[Admin] ";

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
  const body = cleaned.length <= 40 ? cleaned || "New Chat" : `${cleaned.slice(0, 37)}...`;
  return `${ADMIN_SESSION_PREFIX}${body}`;
}

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
    console.error("Failed to persist admin user chat turn:", error);
    return null;
  }
}

async function persistAssistantTurn(
  sessionId: string,
  content: string,
  shouldUpdateTitle: boolean,
  titleSource: string
) {
  try {
    const messageId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ChatMessage" (id, "sessionId", role, content, metadata, "createdAt")
      VALUES (${messageId}, ${sessionId}, ${"assistant"}, ${content}, ${JSON.stringify({})}::jsonb, NOW())
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
    console.error("Failed to persist admin assistant chat turn:", error);
  }
}

function sseResponse(stream: ReadableStream) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  try {
    const { session, error } = await requireAdminUser();
    if (error || !session?.user?.id) {
      return NextResponse.json(error?.body ?? { success: false, error: "Unauthorized" }, {
        status: error?.status ?? 401,
      });
    }

    const userId = session.user.id;
    const json = await request.json();
    const parsed = ChatRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { message, history, sessionId } = parsed.data;

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

    const activeSessionId = await persistUserTurn(userId, message, sessionId);

    const cappedHistory = history
      .filter(
        (m, idx, arr) => !(idx === arr.length - 1 && m.role === "user" && m.content === message)
      )
      .slice(-6);

    const offTopicRefusal = getAdminOffTopicRefusal(message);
    if (offTopicRefusal) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: metadata\ndata: ${JSON.stringify({
                standaloneQuery: message,
                sessionId: activeSessionId,
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: offTopicRefusal })}\n\n`)
          );
          if (activeSessionId) {
            await persistAssistantTurn(
              activeSessionId,
              offTopicRefusal,
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
        },
      });
      return sseResponse(stream);
    }

    const standaloneQuery = await rewriteFollowupQuery(message, cappedHistory);
    let statsContext = "LIVE ADMIN STATS: unavailable (failed to load). Do not invent numbers.";
    try {
      const stats = await getAdminDashboardStats();
      statsContext = formatAdminStatsContext(stats);
    } catch (statsError) {
      console.error("Failed to load admin dashboard stats:", statsError);
    }

    const systemInstruction = `${SYSTEM_ADMIN_PROMPT}

=== CURRENT ADMIN ROUTES ===
- /admin/products — manage catalog, stock, variants, images, bulk upload
- /admin/orders — view and update order status
=================================

=== ${statsContext}
=================================
User standalone question: ${standaloneQuery}`;

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

          if (activeSessionId && accumulated) {
            await persistAssistantTurn(
              activeSessionId,
              accumulated,
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
          console.error("Admin chat stream error:", streamError);
          const errorMsg =
            streamError instanceof Error ? streamError.message : "Error streaming response";
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return sseResponse(stream);
  } catch (error: unknown) {
    console.error("Admin chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
