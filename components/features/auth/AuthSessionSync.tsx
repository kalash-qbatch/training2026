"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";

/** Keeps Zustand in sync with the Auth.js session used by proxy/middleware. */
export function AuthSessionSync() {
  const { data: session, status } = useSession();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      logout();
      return;
    }

    if (!session?.user?.email) return;

    login({
      id: session.user.id || session.user.email,
      fullName:
        session.user.name?.trim() ||
        session.user.email.split("@")[0] ||
        "User",
      email: session.user.email,
      image: session.user.image ?? undefined,
      role: session.user.role === "ADMIN" ? "ADMIN" : "USER",
    });
  }, [status, session, login, logout]);

  return null;
}
