import { Navbar } from "@/components/layout/Navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="mx-auto w-full flex-1 p-4 sm:p-8 lg:px-14 xl:px-15">
        {children}
      </main>
    </div>
  );
}
