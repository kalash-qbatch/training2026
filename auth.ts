import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import {
  REMEMBER_ME_MAX_AGE_SECONDS,
  sessionMaxAgeSeconds,
} from "@/lib/constants/auth";
import authConfig from "./auth.config";

function parseRemember(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: REMEMBER_ME_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: REMEMBER_ME_MAX_AGE_SECONDS,
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials) {
        const remember = parseRemember(credentials?.remember);
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
          remember,
        });
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.fullName || user.name || "User",
          email: user.email!,
          image: user.image,
          role: user.role,
          remember,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.picture = user.image ?? token.picture;
        token.role = user.role ?? "USER";

        const remember = parseRemember(
          (user as { remember?: boolean }).remember
        );
        const maxAge = sessionMaxAgeSeconds(remember);
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }

      // Keep role/profile in sync with DB (covers role changes after login)
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: {
            id: true,
            role: true,
            fullName: true,
            name: true,
            image: true,
          },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.fullName || dbUser.name || token.name;
          if (dbUser.image) token.picture = dbUser.image;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as string) ?? "USER";
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const fullName =
        user.name?.trim() || user.email?.split("@")[0] || "User";
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName,
          name: user.name ?? fullName,
          email: user.email?.toLowerCase() ?? undefined,
          image: user.image ?? undefined,
        },
      });
    },
  },
});
