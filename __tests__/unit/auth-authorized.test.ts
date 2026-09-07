import { readFileSync } from "fs";
import { join } from "path";

import { authorizeRequest, postLoginPath } from "@/lib/auth-routing";

describe("auth routing (admin ↔ storefront)", () => {
  it("auth.ts keeps authConfig.callbacks so authorized is not dropped", () => {
    const src = readFileSync(join(process.cwd(), "auth.ts"), "utf8");
    expect(src).toMatch(/\.\.\.\s*authConfig\.callbacks/);
  });

  it("postLoginPath sends admin to admin products", () => {
    expect(postLoginPath("ADMIN")).toBe("/admin/products");
    expect(postLoginPath("USER")).toBe("/products");
  });

  it("redirects logged-in admin from /products to /admin/products", () => {
    expect(authorizeRequest({ user: { role: "ADMIN" } }, "/products")).toEqual({
      type: "redirect",
      path: "/admin/products",
    });
  });

  it("redirects logged-in admin from /cart to /admin/products", () => {
    expect(authorizeRequest({ user: { role: "ADMIN" } }, "/cart")).toEqual({
      type: "redirect",
      path: "/admin/products",
    });
  });

  it("allows USER on /products", () => {
    expect(authorizeRequest({ user: { role: "USER" } }, "/products")).toEqual({
      type: "allow",
    });
  });

  it("blocks non-admin from /admin", () => {
    expect(authorizeRequest({ user: { role: "USER" } }, "/admin/products")).toEqual({
      type: "redirect",
      path: "/products",
    });
  });

  it("sends logged-in admin away from /login to admin app", () => {
    expect(authorizeRequest({ user: { role: "ADMIN" } }, "/login")).toEqual({
      type: "redirect",
      path: "/admin/products",
    });
  });
});
