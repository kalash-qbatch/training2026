import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      new URL("https://lh3.googleusercontent.com/**"),
      new URL("https://platform-lookaside.fbsbx.com/**"),
      new URL("https://*.fbcdn.net/**"),
      new URL("https://graph.facebook.com/**"),
      new URL("https://*.supabase.co/**"),
      new URL("https://*.supabase.in/**"),
      new URL("https://picsum.photos/**"),
    ],
  },
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "0.0.0.0:3000",
    "192.168.0.19:3000",
    "192.168.0.19",
  ],
};

export default nextConfig;
