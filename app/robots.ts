import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://bhaikastore.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/products/*"],
        disallow: [
          "/admin",
          "/admin/*",
          "/cart",
          "/cart/*",
          "/api/*",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
