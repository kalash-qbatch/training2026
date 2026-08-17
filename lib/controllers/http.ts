import { auth } from "@/auth";

export type ControllerResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      userId: null as string | null,
      error: {
        status: 401,
        body: { success: false, error: "Unauthorized" },
      } satisfies ControllerResult,
    };
  }
  return { userId, error: null };
}

export async function requireAdminUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      error: {
        status: 401,
        body: { success: false, error: "Unauthorized" },
      } satisfies ControllerResult,
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      error: {
        status: 403,
        body: { success: false, error: "Forbidden — admin only" },
      } satisfies ControllerResult,
    };
  }
  return { session, error: null };
}
