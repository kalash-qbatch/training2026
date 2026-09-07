"use client";

import { useEffect } from "react";

import { signOut, useSession } from "next-auth/react";

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
      const wasLoggedIn = useAuthStore.getState().isAuthenticated;
      logout();
      // Clear stale JWT cookie when DB user was deleted (or session expired)
      if (wasLoggedIn) {
        void signOut({ redirect: false });
      }
      return;
    }

    if (!session) return;

    const authUser = sessionToAuthUser(session);
    if (!authUser) {
      logout();
      void signOut({ redirect: false });
      return;
    }

    const current = useAuthStore.getState();
    if (
      !current.isAuthenticated ||
      current.user?.id !== authUser.id ||
      current.user?.email !== authUser.email ||
      current.user?.role !== authUser.role ||
      current.user?.fullName !== authUser.fullName ||
      current.user?.image !== authUser.image
    ) {
      login(authUser);
    }
  }, [status, session, login, logout]);

  return null;
}
