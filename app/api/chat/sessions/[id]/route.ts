import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/chat/sessions/[id] — load one session with messages */
export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const chatSession = await prisma.chatSession.findFirst({
    where: { id, userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  if (!chatSession) {
    return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, session: chatSession });
}

/** DELETE /api/chat/sessions/[id] — delete a session */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  }

  await prisma.chatSession.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
