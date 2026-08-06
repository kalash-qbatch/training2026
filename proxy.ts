import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

/** Next.js 16 requires a function named `proxy` (or a default function export). */
export const proxy = auth;

export const config = {
  // Skip API, Next internals, and static files in /public (e.g. /products/*.jpg)
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads|templates|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|csv)$).*)",
  ],
};
