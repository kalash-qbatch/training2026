import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import { decode as jwtDecode, encode as jwtEncode } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { SESSION_EXPIRY_DEFAULT, SESSION_EXPIRY_REMEMBER_ME } from "@/lib/constants";
import { prisma } from "@/lib/db";

import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: SESSION_EXPIRY_REMEMBER_ME,
    updateAge: SESSION_EXPIRY_REMEMBER_ME,
  },
  jwt: {
    maxAge: SESSION_EXPIRY_REMEMBER_ME,
    async encode({ token, secret, salt, maxAge }) {
      if (!token) return "";

      const expiry = typeof token.exp === "number" ? token.exp : undefined;
      const effectiveMaxAge =
        expiry !== undefined
          ? Math.max(expiry - Math.floor(Date.now() / 1000), 0)
          : (maxAge ?? SESSION_EXPIRY_DEFAULT);

      return jwtEncode({ token, secret, salt, maxAge: effectiveMaxAge });
    },
    async decode({ token, secret, salt }) {
      return jwtDecode({ token, secret, salt });
    },
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID ?? process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || typeof credentials.password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        const rememberMeRaw = credentials.rememberMe;
        const isRememberMe =
          rememberMeRaw === true ||
          rememberMeRaw === "true" ||
          rememberMeRaw === "on" ||
          rememberMeRaw === "1";
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          rememberMe: isRememberMe,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "github") {
        const email =
          user.email ||
          (account.provider === "github"
            ? `${user.id || account.providerAccountId}@github.user`
            : null);
        if (!email) return false;

        const fullName =
          user.name || (account.provider === "github" ? "GitHub User" : "Google User");

        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            fullName,
            phone: "",
            passwordHash: "",
          },
        });

        // Create Stripe customer for OAuth users if they don't have one yet
        if (!dbUser.stripeCustomerId) {
          try {
            const { stripe } = await import("@/lib/stripe");
            const customer = await stripe.customers.create({
              email: dbUser.email,
              name: dbUser.fullName || dbUser.name || "Customer",
              metadata: { userId: dbUser.id },
            });
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { stripeCustomerId: customer.id },
            });
          } catch (err) {
            console.error("Failed to create Stripe customer for OAuth user:", err);
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account) {
        token.provider = account.provider;
      }

      if (typeof token.rememberMe !== "boolean") {
        token.rememberMe = false;
      }

      if (trigger === "update" && typeof session?.rememberMe === "boolean") {
        token.rememberMe = session.rememberMe;
        token.exp =
          Math.floor(Date.now() / 1000) +
          (token.rememberMe ? SESSION_EXPIRY_REMEMBER_ME : SESSION_EXPIRY_DEFAULT);
      }

      if (user) {
        token.id = user.id;
        token.role = user.role;

        let rememberMe = (user as { rememberMe?: boolean }).rememberMe;

        if (
          rememberMe === undefined &&
          (account?.provider === "google" || account?.provider === "github")
        ) {
          try {
            const cookieStore = await cookies();
            const rememberCookie = cookieStore.get("auth_remember_me")?.value;
            if (rememberCookie !== undefined) {
              rememberMe = rememberCookie === "true";
            } else {
              rememberMe = true;
            }
          } catch {
            rememberMe = true;
          }
        }

        token.rememberMe = rememberMe ?? false;

        token.exp =
          Math.floor(Date.now() / 1000) +
          (token.rememberMe ? SESSION_EXPIRY_REMEMBER_ME : SESSION_EXPIRY_DEFAULT);
      } else if (
        (account?.provider === "google" || account?.provider === "github") &&
        token.email
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }

      if (token.email && (!token.id || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        (session.user as { role?: string; provider?: string }).role = token.role as string;
        (session.user as { role?: string; provider?: string }).provider = token.provider as string;
        (session.user as { rememberMe?: boolean }).rememberMe = token.rememberMe as boolean;
      }
      if (token.exp) {
        (session as { expires?: string }).expires = new Date(
          (token.exp as number) * 1000
        ).toISOString();
      }
      return session;
    },
  },
});
