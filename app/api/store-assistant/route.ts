import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { processChatMessage } from "@/lib/chatbot/engine/orchestrator";
import { ChatRequestInputSchema } from "@/lib/chatbot/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "Invalid JSON in request body.",
          type: "error",
          products: [],
        },
        { status: 400 }
      );
    }

    const parsed = ChatRequestInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid request payload. Please provide a message string.",
          type: "error",
          products: [],
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    // Resolve session ID from request or user auth
    const session = await auth();
    const effectiveSessionId =
      parsed.data.sessionId ||
      session?.user?.id ||
      request.headers.get("x-session-id") ||
      "guest_session";

    const response = await processChatMessage({
      message: parsed.data.message,
      sessionId: effectiveSessionId,
      history: parsed.data.history,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("[API:StoreAssistant] Uncaught server error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      {
        message: "I'm having trouble right now, please try again in a moment.",
        type: "error",
        products: [],
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
