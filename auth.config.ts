import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import { ensureAuthEnvUrl } from "@/lib/app-url";
import { authorizeRequest } from "@/lib/auth-routing";

ensureAuthEnvUrl();

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
      const result = authorizeRequest(auth, nextUrl.pathname);
      if (result.type === "redirect") {
        return Response.redirect(new URL(result.path, nextUrl));
      }
      return result.type === "allow";
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
