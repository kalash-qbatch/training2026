"use client";

import { useState } from "react";

import { Menu } from "lucide-react";

import { AdminChatDrawer } from "@/components/admin/AdminChatDrawer";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <AdminSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e5e7eb] bg-white px-4 sm:px-6 lg:justify-end lg:px-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <button
              type="button"
              className="cursor-pointer rounded-md p-1.5 text-[#4b5563] transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandLogo href="/admin/products" size="sm" showWordmark />
          </div>

          <AdminTopBar />
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
      <AdminChatDrawer />
    </div>
  );
}
