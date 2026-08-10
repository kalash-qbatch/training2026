import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/features/auth/AuthProvider";
import { AuthSessionSync } from "@/components/features/auth/AuthSessionSync";
import { CartSync } from "@/components/features/cart/CartSync";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Bhai ka Store",
  description: "Bhai ka Store is a platform for buying and selling products",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <AuthSessionSync />
          <CartSync />
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
