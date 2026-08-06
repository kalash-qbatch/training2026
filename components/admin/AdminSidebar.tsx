"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutGrid, ShoppingBag, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/useAuthStore";

const nav = [
  { href: "/admin/products", label: "Products", icon: LayoutGrid },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  async function onLogout() {
    logout();
    await signOut({ callbackUrl: "/login" });
  }

  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="px-5 py-5">
        <Link
          href="/admin/products"
          className="text-[15px] font-semibold tracking-tight text-[#333333]"
        >
          E-commerce
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition",
                active
                  ? "bg-[#2563EB] text-white"
                  : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded-md border border-[#d0d5dd] bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-[220px] border-r border-[#e5e7eb] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 rounded p-1 text-gray-400"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {content}
          </aside>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-[#e5e7eb] bg-white lg:block">
        {content}
      </aside>
    </>
  );
}
