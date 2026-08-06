"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminTopBar() {
  const { data: session } = useSession();
  const storeUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const name =
    session?.user?.name ||
    storeUser?.fullName ||
    session?.user?.email ||
    "Admin User";
  const image = session?.user?.image || storeUser?.image;

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-md p-1 text-[#333333] transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            width={32}
            height={32}
            className="rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-600">
            {initials(name) || <User className="h-4 w-4" />}
          </span>
        )}
        <span className="hidden text-[13px] font-medium sm:inline">{name}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[#6b7280] transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-[#d0d5dd] bg-white shadow-lg"
        >
          <div className="border-b border-[#e5e7eb] px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-[#333333]">{name}</p>
            <p className="truncate text-[11px] text-[#8a94a6]">
              {session?.user?.email || storeUser?.email || "Administrator"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              logout();
              await signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-[#333333] hover:bg-brand-50 hover:text-brand-600"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
