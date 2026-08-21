"use client";

import { useState } from "react";

import { LayoutGrid, Menu, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin/products", label: "Products", icon: LayoutGrid },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 px-5 py-[15.5px]">
        <Link
          href="/admin/products"
          className="text-[15px] font-semibold tracking-tight text-neutral-text transition-colors duration-200 hover:text-[#2563EB]"
        >
          E-commerce
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3 pb-4">
        <div className="flex flex-col gap-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-in-out",
                  active
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-neutral-900"
                )}
              >
                <Icon
                  className="h-4 w-4 transition-transform duration-200 ease-in-out"
                  strokeWidth={1.75}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 cursor-pointer rounded-md border border-neutral-border bg-white p-2 shadow-sm transition-all duration-200 hover:bg-[#f8fafc] lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-55 border-r border-[#e5e7eb] bg-white shadow-xl transition-transform duration-300 ease-in-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-2 top-2 z-10 cursor-pointer rounded p-1 text-gray-400 transition-colors duration-200 hover:bg-[#f3f4f6] hover:text-neutral-900"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          {content}
        </aside>
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-55 border-r border-[#e5e7eb] bg-white lg:block">
        {content}
      </aside>
    </>
  );
}
