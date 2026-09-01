import type { Session } from "next-auth";

import type { User } from "@/types";

/** Maps an Auth.js session into the Zustand auth store shape. */
export function sessionToAuthUser(session: Session): User | null {
  const { user } = session;
  if (!user?.id && !user?.email) return null;

  const email = user.email ?? `${user.id}@oauth.user`;

  return {
    id: user.id || email,
    fullName: user.name?.trim() || email.split("@")[0] || "User",
    email,
    image: user.image ?? undefined,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
  };
}
