import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/features/auth/AuthProvider";
import { AuthSessionSync } from "@/components/features/auth/AuthSessionSync";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "E-Commerce User Module",
  description: "Responsive e-commerce user module with auth, cart, and orders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <AuthProvider>
          <AuthSessionSync />
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
