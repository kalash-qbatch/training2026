import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/products");
  if (session.user.role !== "ADMIN") redirect("/products");

  return <AdminShell>{children}</AdminShell>;
}
