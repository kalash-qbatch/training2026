"use client";

import { ShoppingBag } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";

const NotificationsPopover = dynamic(
  () =>
    import("@/components/layout/NotificationsPopover").then((m) => ({
      default: m.NotificationsPopover,
    })),
  {
    ssr: false,
    loading: () => (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-bg animate-pulse" />
    ),
  }
);

const UserMenuLazy = dynamic(
  () => import("@/components/layout/UserMenu").then((m) => ({ default: m.UserMenu })),
  {
    ssr: false,
    loading: () => (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-bg animate-pulse" />
    ),
  }
);

function AuthNavSkeleton() {
  return (
    <>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-bg animate-pulse" />
      <span className="inline-flex h-8 w-24 items-center gap-2 rounded-full bg-neutral-bg animate-pulse" />
    </>
  );
}

export function Navbar() {
  const { status } = useSession();
  const isAuthenticatedStore = useAuthStore((s) => s.isAuthenticated);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));

  const authLoading = status === "loading";
  const isAuthenticated = status === "authenticated" || isAuthenticatedStore;
  const showLoggedInChrome = authLoading || isAuthenticated;

  return (
    <header className="border-b border-[#e5e7eb] sticky top-0 z-50 bg-white">
      <div
        className={`mx-auto flex items-center justify-between px-4 sm:px-6 h-12 lg:px-8 ${showLoggedInChrome ? "py-1" : "py-3.5"}`}
      >
        <Link
          href="/products"
          prefetch={false}
          className="text-[15px] font-semibold tracking-tight text-[#333333]"
        >
          Bhai ka Store
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/cart"
            className="relative p-1 text-[#333333] hover:text-brand-500"
            aria-label="Shopping bag"
          >
            <ShoppingBag className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.5} />
            {itemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>

          {authLoading ? (
            <AuthNavSkeleton />
          ) : isAuthenticated ? (
            <>
              <NotificationsPopover />
              <UserMenuLazy />
            </>
          ) : (
            <Link
              href="/login"
              className="text-[14px] font-medium text-brand-500 hover:text-brand-500"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
