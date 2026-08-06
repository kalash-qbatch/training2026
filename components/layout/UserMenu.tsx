"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, History, LayoutDashboard, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { cn } from "@/lib/utils";
import { OrdersDrawer } from "@/components/features/orders/OrdersDrawer";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image?: string;
  size?: number;
}) {
  const label = initials(name);

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className="flex items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {label || <User className="h-4 w-4" />}
    </span>
  );
}

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md p-1 text-neutral-text hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Avatar name={user.fullName} image={user.image} size={32} />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
          {user.fullName.split(" ")[0]}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-border bg-neutral-surface shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-neutral-border px-3 py-3">
            <Avatar name={user.fullName} image={user.image} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-text">
                {user.fullName}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-muted">
                {user.email}
              </p>
            </div>
          </div>

          {user.role === "ADMIN" ? (
            <Link
              role="menuitem"
              href="/admin/products"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-text hover:bg-brand-50 hover:text-brand-600"
            >
              <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} />
              Admin dashboard
            </Link>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setOrdersOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-text hover:bg-brand-50 hover:text-brand-600"
            >
              <History className="h-4 w-4" strokeWidth={1.75} />
              Order history
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              logout();
              await signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-text hover:bg-brand-50 hover:text-brand-600"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Logout
          </button>
        </div>
      ) : null}

      <OrdersDrawer open={ordersOpen} onClose={() => setOrdersOpen(false)} />
    </div>
  );
}
