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

const BASE_URL =
  process.env.NEXTAUTH_URL ||
  process.env.AUTH_URL ||
  "https://bhaikastore.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Bhai ka Store | Premium E-Commerce Storefront",
    template: "%s | Bhai ka Store",
  },
  description:
    "Discover premium products with instant checkout, live variant stock, and fast delivery at Bhai ka Store.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Bhai ka Store",
    title: "Bhai ka Store | Premium E-Commerce Storefront",
    description:
      "Discover premium products with instant checkout, live variant stock, and fast delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bhai ka Store",
    description: "Discover premium products with instant checkout and fast delivery.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
