import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import { decode as jwtDecode, encode as jwtEncode } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import { SESSION_EXPIRY_DEFAULT, SESSION_EXPIRY_REMEMBER_ME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";

import authConfig from "./auth.config";

const SOCIAL_PROVIDERS = new Set(["google", "facebook"]);

function socialFallbackEmail(provider: string, userId: string, providerAccountId: string) {
  if (provider === "facebook") return `${providerAccountId}@facebook.user`;
  return `${userId || providerAccountId}@oauth.user`;
}

function socialFallbackName(provider: string) {
  if (provider === "facebook") return "Facebook User";
  if (provider === "google") return "Google User";
  return "User";
}

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
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      // email scope requires Meta app permission setup; public_profile works without it
      authorization: { params: { scope: "public_profile" } },
      userinfo: { params: { fields: "id,name,picture" } },
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
      if (account?.provider && SOCIAL_PROVIDERS.has(account.provider)) {
        const email =
          user.email ||
          socialFallbackEmail(account.provider, user.id ?? "", account.providerAccountId);
        if (!email) return false;

        const fullName = user.name || socialFallbackName(account.provider);

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
        if (!dbUser.stripeCustomerId && isStripeConfigured()) {
          try {
            const { getStripe } = await import("@/lib/stripe");
            const customer = await getStripe().customers.create({
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
        let rememberMe = (user as { rememberMe?: boolean }).rememberMe;

        if (
          rememberMe === undefined &&
          account?.provider &&
          SOCIAL_PROVIDERS.has(account.provider)
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

        if (account?.provider && SOCIAL_PROVIDERS.has(account.provider)) {
          const email =
            user.email ||
            socialFallbackEmail(account.provider, user.id ?? "", account.providerAccountId ?? "");
          token.email = email;

          const dbUser = await prisma.user.findUnique({ where: { email } });
          token.id = dbUser?.id ?? user.id;
          token.role = dbUser?.role ?? user.role;
        } else {
          token.id = user.id;
          token.role = user.role;
        }
      } else if (account?.provider && SOCIAL_PROVIDERS.has(account.provider) && token.email) {
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
      if (token.email) {
        session.user.email = token.email as string;
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
