"use client";

import { useEffect } from "react";

import { useSession } from "next-auth/react";

import { sessionToAuthUser } from "@/lib/session-user";
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

    if (!session) return;

    const authUser = sessionToAuthUser(session);
    if (!authUser) return;

    const current = useAuthStore.getState();
    if (
      !current.isAuthenticated ||
      current.user?.id !== authUser.id ||
      current.user?.email !== authUser.email
    ) {
      login(authUser);
    }
  }, [status, session, login, logout]);

  return null;
}
