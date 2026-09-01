export const PRODUCTION_APP_URL = "https://bhaikastore.com";

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Resolves the public app URL for OAuth callbacks and auth redirects.
 * Ignores localhost env values when running on Vercel / production.
 */
export function resolveAuthBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
  const nextAuthUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "");

  if (authUrl && !isLocalhostUrl(authUrl)) return authUrl;
  if (vercelUrl) return vercelUrl;
  if (nextAuthUrl && !isLocalhostUrl(nextAuthUrl)) return nextAuthUrl;
  if (process.env.NODE_ENV === "production") return PRODUCTION_APP_URL;
  return authUrl || nextAuthUrl || "http://localhost:3000";
}

/**
 * This function is used to ensure that the Auth.js reads the correct public URL (not localhost on Vercel).
 * Ensures Auth.js reads the correct public URL (not localhost on Vercel).
 * Import this module early from auth.config.ts before NextAuth initializes.
 */
export function ensureAuthEnvUrl(): void {
  const resolved = resolveAuthBaseUrl();
  process.env.AUTH_URL = resolved;

  const onDeployed =
    Boolean(process.env.VERCEL_URL) ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1";

  if (onDeployed && (!process.env.NEXTAUTH_URL || isLocalhostUrl(process.env.NEXTAUTH_URL))) {
    process.env.NEXTAUTH_URL = resolved;
  }
}

/** Server-side app base URL (auth, emails, metadata, sitemap). */
export function getServerAppUrl(): string {
  return resolveAuthBaseUrl();
}

/** Auth redirect target — uses current browser origin on the client. */
export function authCallbackUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalized}`;
  }
  return `${getServerAppUrl()}${normalized}`;
}
