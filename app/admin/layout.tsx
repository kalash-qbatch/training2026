import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/products");
  if (session.user.role !== "ADMIN") redirect("/products");

  return (
    <div className="min-h-screen bg-white">
      <AdminSidebar />
      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end border-b border-[#e5e7eb] bg-white px-4 sm:px-6 lg:px-8">
          <AdminTopBar />
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
