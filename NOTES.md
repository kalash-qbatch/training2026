# NOTES — E-Commerce User Module

## Assumptions

- Ignored the dark wireframe canvas “User Module / market bar” per request; shop pages use a light nav (`Products` / `Cart` / `Orders`) instead.
- Migrated routing from Pages Router to **App Router**. Old `pages/` backup removed — auth backend is App Router only (`app/api/auth` + `auth.ts`).
- Auth uses **Auth.js** (Google, GitHub, credentials) with Prisma. Demo users from seed: `alex@example.com` / `Password1!`.
- Password reset emails via SMTP; link expiry from `lib/constants/auth.ts`.
- Tax is a flat **8%** of subtotal.
- Zod **v4** is used (`z.email()` API).

## How to test

1. `yarn dev` → open `/login`
2. Sign in with demo credentials → redirected to `/products`
3. Search/sort, add items with qty stepper → `/cart`
4. Remove item (confirm modal), place order → toast + `/orders`
5. Open eye icon → `/orders/[id]`
6. Try `/register`, `/forgot-password`, `/reset-password?token=demo`
7. Logout, hit `/products` → redirect to `/login`
