import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import { ensureAuthEnvUrl } from "@/lib/app-url";

ensureAuthEnvUrl();

const authPages = ["/login", "/register", "/signup", "/forgot-password", "/reset-password"];

function postLoginPath(role?: string | null) {
  return role === "ADMIN" ? "/admin/products" : "/products";
}

function roleFromAuth(auth: { user?: unknown } | null) {
  return (auth?.user as { role?: string } | undefined)?.role;
}

export default {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Edge/middleware must map JWT claims onto session.user
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id ?? "";
        session.user.role = (token.role as string) ?? "USER";
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const role = roleFromAuth(auth);
      const isAdmin = role === "ADMIN";
      const isAuthPage = authPages.some((p) => pathname.startsWith(p));

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL(postLoginPath(role), nextUrl));
        }
        return true;
      }

      // Admins always use the admin app shell
      const isStorefrontRoute =
        pathname === "/" || pathname === "/products" || pathname.startsWith("/cart");

      if (isLoggedIn && isAdmin && isStorefrontRoute) {
        return Response.redirect(new URL("/admin/products", nextUrl));
      }

      const isPublicRoute = pathname === "/" || pathname === "/products";

      if (isPublicRoute) {
        return true;
      }

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/admin") && !isAdmin) {
        return Response.redirect(new URL("/products", nextUrl));
      }

      return true;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
