import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: string;
      provider?: string;
      rememberMe?: boolean;
    };
  }

  interface User {
    role?: string;
    provider?: string;
    rememberMe?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    provider?: string;
    rememberMe?: boolean;
    expiresAt?: number;
  }
}
