const AUTH_PAGES = ["/login", "/register", "/signup", "/forgot-password", "/reset-password"];

export function postLoginPath(role?: string | null) {
  return role === "ADMIN" ? "/admin/products" : "/products";
}

export function roleFromAuth(auth: { user?: unknown } | null) {
  return (auth?.user as { role?: string } | undefined)?.role;
}

/** Shared by Auth.js `authorized` callback — keep admin off the storefront shell. */
export function authorizeRequest(auth: { user?: unknown } | null, pathname: string) {
  const isLoggedIn = !!auth?.user;
  const role = roleFromAuth(auth);
  const isAdmin = role === "ADMIN";
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    if (isLoggedIn) {
      return { type: "redirect" as const, path: postLoginPath(role) };
    }
    return { type: "allow" as const };
  }

  const isStorefrontRoute =
    pathname === "/" || pathname === "/products" || pathname.startsWith("/cart");

  if (isLoggedIn && isAdmin && isStorefrontRoute) {
    return { type: "redirect" as const, path: "/admin/products" };
  }

  const isPublicRoute = pathname === "/" || pathname === "/products";

  if (isPublicRoute) {
    return { type: "allow" as const };
  }

  if (!isLoggedIn) {
    return { type: "deny" as const };
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    return { type: "redirect" as const, path: "/products" };
  }

  return { type: "allow" as const };
}
