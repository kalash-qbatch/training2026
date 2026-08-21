# Cart Attack — Implementation Plan

> **Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · Prisma ORM · PostgreSQL · Auth.js v5 (NextAuth)
>
> **Principle**: Each phase is self-contained and independently deployable. A coding agent should implement **one phase at a time**, verify it, then move to the next.

---

## Table of Contents

- [Phase 1 — Project Foundation & Configuration](#phase-1--project-foundation--configuration)
- [Phase 2 — Database Schema & Prisma Setup](#phase-2--database-schema--prisma-setup)
- [Phase 3 — Reusable UI Component Library](#phase-3--reusable-ui-component-library)
- [Phase 4 — Authentication: Register & Login](#phase-4--authentication-register--login)
- [Phase 5 — Authentication: Forgot & Reset Password + Middleware](#phase-5--authentication-forgot--reset-password--middleware)
- [Phase 6 — Products Listing & Product Details](#phase-6--products-listing--product-details)
- [Phase 7 — Cart System](#phase-7--cart-system)
- [Phase 8 — Orders System](#phase-8--orders-system)
- [Phase 9 — Polish: Error States, Loading, Empty States, Responsiveness & Accessibility](#phase-9--polish-error-states-loading-empty-states-responsiveness--accessibility)
- [Phase 10 — Structured Logging with Pino](#phase-10--structured-logging-with-pino)

---

## Design Reference

The UI must closely match the provided Figma/design screenshots:

| Screen              | Key Elements                                                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SignUp**          | Full name, email, mobile, password, confirm password fields. Blue "SignUp" button. "Already have an account! Login" link.                                                                                                                                                        |
| **Login**           | Email, password fields. "Remember me" checkbox. Blue "Login" button. "Forgot Password! Reset" link. "I don't have an account! SignUp" link. Inline validation (red error text).                                                                                                  |
| **Forgot Password** | Email field. Blue "Forgot Password" button. "No, I remember my password! Login" link.                                                                                                                                                                                            |
| **Reset Password**  | New password, confirm password fields. Password strength hint (red). Blue "Reset Password" button.                                                                                                                                                                               |
| **Products**        | Navbar ("E-commerce" logo, home/bell/cart icons, "Login" link). "Our Products" heading. Search bar + Sort dropdown. 4-column responsive product grid (image, title, price, qty selector ±, "Add to Cart" button).                                                                |
| **Cart**            | "← Your Shopping Bag" heading. Table with columns: checkbox, Product (image + title), Color, Size, Qty (± controls), Price, Actions (delete icon). Sub Total / Tax / Total summary. "Place Order" button. Green success toast. Remove confirmation modal (warning icon, Yes/No). |
| **User Menu**       | Dropdown from user avatar: "Orders", "Logout".                                                                                                                                                                                                                                   |

---

## Shared Architecture Decisions

These apply across **all** phases:

### Folder Structure

```
cart-attack/
├── app/
│   ├── (auth)/                  # Route group — auth pages (no navbar)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (main)/                  # Route group — protected pages (with navbar)
│   │   ├── layout.tsx           # Navbar + Footer wrapper
│   │   ├── products/
│   │   │   ├── page.tsx         # Product listing
│   │   │   └── [id]/page.tsx    # Product detail
│   │   ├── cart/page.tsx
│   │   └── orders/
│   │       ├── page.tsx         # Order history
│   │       └── [id]/page.tsx    # Order detail
│   ├── api/                     # Route Handlers (REST API)
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts  # Auth.js catch-all handler
│   │   │   ├── register/route.ts       # Custom registration endpoint
│   │   │   ├── forgot-password/route.ts
│   │   │   └── reset-password/route.ts
│   │   ├── products/
│   │   │   └── route.ts         # GET (list, search, sort, paginate)
│   │   ├── cart/
│   │   │   └── route.ts         # GET, POST, PATCH, DELETE
│   │   └── orders/
│   │       └── route.ts         # GET, POST
│   ├── layout.tsx               # Root layout
│   ├── globals.css
│   ├── not-found.tsx
│   └── favicon.ico
├── components/
│   ├── ui/                      # Primitive reusable components
│   ├── features/                # Feature-specific composed components
│   └── layout/                  # Navbar, Footer, etc.
├── auth.ts                        # Auth.js v5 main config (NextAuth + Credentials provider)
├── auth.config.ts                 # Edge-compatible auth config (for middleware)
├── lib/
│   ├── db.ts                    # Prisma client singleton
│   ├── validations/             # Zod schemas
│   └── utils.ts                 # Shared utilities
├── hooks/                       # Custom React hooks
├── types/                       # Shared TypeScript types/interfaces
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                  # Seed script for products
├── middleware.ts                 # Auth guard middleware
└── public/
```

### API Response Contract

All API routes return a consistent shape:

```typescript
// Success
{ success: true, data: T, message?: string }

// Error
{ success: false, error: string, details?: Record<string, string[]> }
```

### Validation Strategy

- **Server-side**: Zod schemas in `lib/validations/` — every API route validates input.
- **Client-side**: Same Zod schemas reused for instant inline validation on forms.

### Authentication Strategy

- **Auth.js v5 (NextAuth)** with `Credentials` provider for email/password login.
- `@auth/prisma-adapter` for session/account persistence.
- `session: { strategy: "jwt" }` — JWT-based sessions (no DB session table needed).
- `middleware.ts` uses Auth.js's exported middleware to protect `(main)` routes.
- Authenticated users hitting `(auth)` routes are redirected to `/products`.
- Registration handled via a separate custom API route (Auth.js Credentials doesn't auto-register).

### Styling Approach

- Tailwind CSS v4 (already configured via `@tailwindcss/postcss`).
- Design tokens defined in `globals.css` via `@theme inline`.
- Color palette extracted from designs: primary blue `#2979FF`, error red `#E53935`, success green `#43A047`, neutral grays.

### Responsive Design Reference

All UI implementations **must** target and verify these four breakpoints extracted from the design screenshots:

| Breakpoint        | Viewport  | Grid Cols | Tailwind Prefix   | Layout Notes                                            |
| ----------------- | --------- | --------- | ----------------- | ------------------------------------------------------- |
| **Mobile**        | 428×926   | 2         | `default` / `sm:` | Search/sort stacked below heading. Full-width controls. |
| **Tablet**        | 1080×800  | 3         | `md:`             | Search/sort right-aligned on same row as heading.       |
| **Small Desktop** | 1280×800  | 4         | `lg:`             | Same as desktop layout.                                 |
| **Desktop**       | 1366×1132 | 4         | `lg:` / `xl:`     | Full 4-column grid. Maximum content width.              |

**Mandatory rules for all UI work:**

1. Every page and component must be visually verified at all four breakpoints above.
2. Product grids use: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
3. Navigation, search bars, and action buttons must remain accessible and usable on mobile (428px width).
4. Tables (cart, orders) must use horizontal scroll or card-based reflow on mobile.
5. Modals must be full-screen on mobile, centered card on desktop.
6. Auth forms are centered cards that remain max-width constrained on all viewports.

---

## Phase 1 — Project Foundation & Configuration

> **Goal**: Set up the project scaffolding, tooling, environment config, and design tokens so every subsequent phase builds on a solid base.

### Tasks

- [ ] **1.1 — Environment & Dependencies**
  - Install required dependencies:
    ```
    prisma, @prisma/client, bcryptjs, @types/bcryptjs, next-auth@beta, @auth/prisma-adapter, zod, nodemailer, @types/nodemailer
    ```
  - Generate auth secret: `npx auth secret` (auto-adds `AUTH_SECRET` to `.env.local`).
  - Create `.env` (gitignored) with:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/cart_attack"
    AUTH_SECRET="<generated-by-npx-auth-secret>"
    EMAIL_SENDER="noreply@cartattack.com"
    RESET_TOKEN_EXP="3600000"
    SMTP_HOST="smtp.example.com"
    SMTP_PORT="587"
    SMTP_USER="user"
    SMTP_PASS="password"
    ```
  - Add `.env` to `.gitignore` if not already present.
  - Create `.env.example` with placeholder values for documentation.

- [ ] **1.2 — Design Tokens & Global Styles**
  - Update `app/globals.css`:
    - Define color tokens (primary, error, success, warning, grays, background, foreground).
    - Define spacing, border-radius, shadow, and typography tokens via `@theme inline`.
    - Set base body styles: `font-family`, `background`, `color`, `antialiased`.
    - Remove dark mode media query (the designs are light-only).

- [ ] **1.3 — Root Layout**
  - Update `app/layout.tsx`:
    - Set proper `<title>` and `<meta description>` for SEO.
    - Use `next/font/google` to load **Inter** (matches the clean SaaS aesthetic in designs).
    - Apply font CSS variable to `<html>`.

- [ ] **1.4 — Utility Files**
  - Create `lib/utils.ts` — shared helpers (`cn()` for classname merging, `formatCurrency()`, `sleep()` for dev).
  - Create `types/index.ts` — shared TypeScript interfaces/types (will be populated in later phases).

- [ ] **1.5 — Next.js Config**
  - Update `next.config.ts` to allow external image domains (for product images if using external URLs).

### Verification

- `npm run dev` starts without errors.
- `.env` is gitignored.
- Design tokens are accessible via Tailwind classes.
- No regressions from the default scaffold.

---

## Phase 2 — Database Schema & Prisma Setup

> **Goal**: Define the complete PostgreSQL schema via Prisma, create the DB client singleton, and seed product data.

### Tasks

- [ ] **2.1 — Initialize Prisma**
  - Run `npx prisma init` (creates `prisma/schema.prisma` and updates `.env`).
  - Set `provider = "postgresql"` in `schema.prisma`.

- [ ] **2.2 — Define Schema**

  ```prisma
  model User {
    id             String    @id @default(uuid())
    fullName       String
    email          String    @unique
    phone          String
    passwordHash   String
    resetToken     String?
    resetTokenExp  DateTime?
    createdAt      DateTime  @default(now())
    updatedAt      DateTime  @updatedAt

    cartItems      CartItem[]
    orders         Order[]
  }

  model Product {
    id          String   @id @default(uuid())
    title       String
    description String
    price       Decimal  @db.Decimal(10, 2)
    image       String
    color       String?
    size        String?
    stock       Int      @default(100)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    cartItems   CartItem[]
    orderItems  OrderItem[]
  }

  model CartItem {
    id        String   @id @default(uuid())
    quantity  Int      @default(1)
    userId    String
    productId String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
    product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

    @@unique([userId, productId])
  }

  model Order {
    id        String      @id @default(uuid())
    userId    String
    status    OrderStatus @default(PENDING)
    subTotal  Decimal     @db.Decimal(10, 2)
    tax       Decimal     @db.Decimal(10, 2)
    total     Decimal     @db.Decimal(10, 2)
    createdAt DateTime    @default(now())
    updatedAt DateTime    @updatedAt

    user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
    items OrderItem[]
  }

  model OrderItem {
    id        String  @id @default(uuid())
    quantity  Int
    price     Decimal @db.Decimal(10, 2)
    orderId   String
    productId String

    order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
    product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  }

  enum OrderStatus {
    PENDING
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
  }
  ```

- [ ] **2.3 — Prisma Client Singleton**
  - Create `lib/db.ts`:
    ```typescript
    import { PrismaClient } from "@prisma/client";

    const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

    export const prisma = globalForPrisma.prisma || new PrismaClient();

    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
    ```

- [ ] **2.4 — Seed Script**
  - Create `prisma/seed.ts` with **15–20 hardcoded random products** using open-source Unsplash image URLs.
  - Product categories: electronics, clothing, footwear, accessories, home decor.
  - Use direct Unsplash image URLs (e.g., `https://images.unsplash.com/photo-<id>?w=400&h=400&fit=crop`) — no API key needed.
  - Example product objects:
    ```typescript
    const products = [
      {
        title: "Wireless Noise-Cancelling Headphones",
        description: "...",
        price: 79.99,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
        color: "Black",
        size: null,
      },
      {
        title: "Classic Leather Sneakers",
        description: "...",
        price: 129.99,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
        color: "Red",
        size: "10",
      },
      // ... 13-18 more products
    ];
    ```
  - Add seed script to `package.json`:
    ```json
    "prisma": { "seed": "tsx prisma/seed.ts" }
    ```
  - Install `tsx` as a dev dependency for running the seed.

- [ ] **2.5 — Run Migrations & Seed**
  - Run `npx prisma migrate dev --name init`.
  - Run `npx prisma db seed`.
  - Verify data in Prisma Studio (`npx prisma studio`).

### Verification

- `npx prisma migrate dev` completes without errors.
- `npx prisma studio` shows all 5 tables with correct columns.
- Seed data populates 15–20 products.
- `prisma` client imports correctly in a test route.

---

## Phase 3 — Reusable UI Component Library

> **Goal**: Build every primitive and compound UI component needed across the app. No page wiring yet — just the building blocks.

### Tasks

- [ ] **3.1 — Primitive Components** (`components/ui/`)

  | Component  | Props                                                                                                                                    | Notes                                                                                         |
  | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | `Button`   | `variant` (primary / outline / danger / ghost), `size` (sm / md / lg), `loading`, `disabled`, `fullWidth`, `type`, `onClick`, `children` | Blue primary matches designs. Loading state shows spinner.                                    |
  | `Input`    | `label`, `type`, `placeholder`, `error`, `disabled`, `value`, `onChange`, `name`, `id`                                                   | Renders label above, input with border, red error text below. Matches login/register designs. |
  | `Badge`    | `variant` (success / warning / info / danger), `children`                                                                                | For order status tags.                                                                        |
  | `Spinner`  | `size` (sm / md / lg)                                                                                                                    | CSS-only animated spinner.                                                                    |
  | `Skeleton` | `className`, `variant` (text / circle / rect)                                                                                            | Loading placeholder with shimmer animation.                                                   |

- [ ] **3.2 — Compound Components** (`components/ui/`)

  | Component                  | Props                                                                                        | Notes                                                                                               |
  | -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
  | `Modal`                    | `isOpen`, `onClose`, `title`, `children`                                                     | Overlay + centered card. Trap focus, close on Escape & overlay click. Used for delete confirmation. |
  | `ConfirmDialog`            | `isOpen`, `onClose`, `onConfirm`, `title`, `message`, `confirmText`, `cancelText`, `variant` | Wraps Modal. Warning icon + message + Yes/No buttons. Matches "Remove Product" design.              |
  | `Toast` / `ToastContainer` | `type` (success / error / info), `message`, `onClose`                                        | Top-right green/red bar with × close. Matches "order placed successfully" design.                   |
  | `Pagination`               | `currentPage`, `totalPages`, `onPageChange`                                                  | Numbered page buttons with prev/next arrows.                                                        |
  | `SearchBar`                | `value`, `onChange`, `placeholder`                                                           | Input with search icon. Matches products page design.                                               |
  | `SortDropdown`             | `value`, `onChange`, `options`                                                               | "Sort by:" dropdown. Matches products page design.                                                  |
  | `QuantitySelector`         | `value`, `onChange`, `min`, `max`                                                            | − / value / + inline control. Matches cart & product designs.                                       |
  | `EmptyState`               | `icon`, `title`, `description`, `action?`                                                    | Centered illustration + text for empty lists.                                                       |
  | `ProductCard`              | `product`                                                                                    | Image, title, price, quantity selector, "Add to Cart" button. Matches product grid card design.     |

- [ ] **3.3 — Layout Components** (`components/layout/`)

  | Component    | Notes                                                                                                                                                                   |
  | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `Navbar`     | Left: "E-commerce" text logo. Right: home icon, bell icon, cart icon (link to /cart), "Login" link (or user avatar dropdown when authenticated). Matches design navbar. |
  | `UserMenu`   | Dropdown from avatar/name: "Orders" link, "Logout" button. Matches design dropdown.                                                                                     |
  | `Footer`     | Minimal footer (optional — not shown in designs, keep simple).                                                                                                          |
  | `AuthLayout` | Centered card on light gray background. Used by all (auth) pages. Matches login/register design wrapper.                                                                |

- [ ] **3.4 — Toast Context**
  - Create `hooks/useToast.ts` and a `ToastProvider` context.
  - Provides `showToast(type, message)` anywhere in the app.
  - Wrap root layout with `ToastProvider`.

### Verification

- Each component renders correctly in isolation (visit a test page or use Prisma Studio as visual confirmation).
- All components accept TypeScript props with no `any` types.
- Keyboard navigation works on Modal (focus trap, Escape to close).
- Components match the design aesthetic: clean, rounded, blue primary, soft shadows.

---

## Phase 4 — Authentication: Register & Login

> **Goal**: Implement user registration and login using Auth.js v5 (NextAuth) with Credentials provider, PrismaAdapter, and JWT sessions.

### Tasks

- [ ] **4.1 — Zod Validation Schemas** (`lib/validations/auth.ts`)
  - `registerSchema`: fullName (required, min 2), email (valid email), phone (valid phone pattern), password (min 8, must contain uppercase, lowercase, number, symbol), confirmPassword (must match password).
  - `loginSchema`: email (valid email), password (required, min 1).

- [ ] **4.2 — Auth.js Edge Config** (`auth.config.ts`)
  - Edge-compatible config (no Prisma imports — Prisma doesn't run on Edge):
    ```typescript
    import type { NextAuthConfig } from "next-auth";
    export default {
      pages: { signIn: "/login" },
      callbacks: {
        authorized({ auth, request: { nextUrl } }) {
          const isLoggedIn = !!auth?.user;
          const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].some(
            (p) => nextUrl.pathname.startsWith(p)
          );
          if (isAuthPage && isLoggedIn) return Response.redirect(new URL("/products", nextUrl));
          if (!isAuthPage && !isLoggedIn) return false; // redirects to signIn page
          return true;
        },
      },
      providers: [], // populated in auth.ts
    } satisfies NextAuthConfig;
    ```

- [ ] **4.3 — Auth.js Main Config** (`auth.ts`)
  - Full config with Prisma + Credentials provider:
    ```typescript
    import NextAuth from "next-auth";
    import Credentials from "next-auth/providers/credentials";
    import { PrismaAdapter } from "@auth/prisma-adapter";
    import bcrypt from "bcryptjs";
    import { prisma } from "@/lib/db";
    import authConfig from "./auth.config";

    export const { handlers, signIn, signOut, auth } = NextAuth({
      ...authConfig,
      adapter: PrismaAdapter(prisma),
      session: { strategy: "jwt" },
      providers: [
        Credentials({
          async authorize(credentials) {
            const user = await prisma.user.findUnique({
              where: { email: credentials.email as string },
            });
            if (!user) return null;
            const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
            if (!valid) return null;
            return { id: user.id, name: user.fullName, email: user.email };
          },
        }),
      ],
      callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
          if (user) {
            token.id = user.id;
          }
          return token;
        },
        async session({ session, token }) {
          if (token.id) {
            session.user.id = token.id as string;
          }
          return session;
        },
      },
    });
    ```

- [ ] **4.4 — Auth.js Route Handler** (`app/api/auth/[...nextauth]/route.ts`)
  - ```typescript
    import { handlers } from "@/auth";
    export const { GET, POST } = handlers;
    ```

- [ ] **4.5 — Register API** (`app/api/auth/register/route.ts`)
  - `POST` handler:
    1. Parse & validate body with `registerSchema`.
    2. Check if email already exists → 409 error.
    3. Hash password with bcrypt (salt rounds 12), create user in DB.
    4. Return success (do NOT auto-login; redirect to login page).
  - **Note**: Auth.js Credentials provider doesn't handle registration — this stays as a custom route.

- [ ] **4.6 — Register Page** (`app/(auth)/register/page.tsx`)
  - UI matching the **SignUp** design:
    - "SignUp" heading in blue.
    - Form fields: Fullname, Email address, Mobile, Password, Confirm Password.
    - Each field uses the `Input` component with label above.
    - Inline red error messages below invalid fields.
    - Blue full-width "SignUp" button (disabled + spinner while submitting).
    - "Already have an account! Login" link below.
  - Client Component (`'use client'`).
  - On submit: call `/api/auth/register`, show success toast, redirect to `/login`.

- [ ] **4.7 — Login Page** (`app/(auth)/login/page.tsx`)
  - UI matching the **Login** design:
    - "Login" heading in blue.
    - Email field with inline validation ("Enter a valid email address" in red).
    - Password field.
    - "Remember me" checkbox.
    - Blue full-width "Login" button.
    - "Forgot Password! Reset" link.
    - "I don't have an account! SignUp" link.
  - Client Component.
  - On submit: call `signIn("credentials", { email, password, redirect: false })` from `next-auth/react`.
  - On success: `router.push("/products")`. On error: show inline error.

- [ ] **4.8 — Auth Layout** (`app/(auth)/layout.tsx`)
  - Centered card layout on light gray `#F5F7FA` background.
  - No navbar, no footer. Just the card in the center of the viewport.

### Verification

- Register with valid data → user appears in DB → redirects to login.
- Register with duplicate email → shows "Email already exists" error.
- Register with invalid fields → inline errors appear for each invalid field.
- Login with valid credentials → Auth.js session created → redirects to `/products`.
- Login with wrong password → shows error message.
- Login with invalid email format → inline "Enter a valid email address" shown.
- Logout via `signOut()` → session cleared → redirect to `/login`.

---

## Phase 5 — Authentication: Forgot & Reset Password + Middleware

> **Goal**: Complete the auth flow with forgot/reset password. Wire up Auth.js middleware for route protection.

### Tasks

- [ ] **5.1 — Zod Schemas** (`lib/validations/auth.ts` — extend)
  - `forgotPasswordSchema`: email (valid email).
  - `resetPasswordSchema`: token (required), password (same rules as register), confirmPassword (must match).

- [ ] **5.2 — Forgot Password API** (`app/api/auth/forgot-password/route.ts`)
  - `POST` handler:
    1. Validate email with schema.
    2. Find user by email. If not found, **still return success** (prevent email enumeration).
    3. Generate a random reset token (crypto.randomUUID or crypto.randomBytes).
    4. Save `resetToken` and `resetTokenExp` (calculated using `RESET_TOKEN_EXP` from `.env`) on the user record.
    5. Send the reset token via email using `nodemailer` and SMTP env variables. The email sender should be `EMAIL_SENDER` from `.env`. The email should use a simple, styled HTML template (e.g., matching the app's primary color with a clear call-to-action button to reset the password). Avoid basic plain text.
    6. Return success with message "If the email exists, a reset link has been sent."

- [ ] **5.3 — Reset Password API** (`app/api/auth/reset-password/route.ts`)
  - `POST` handler:
    1. Validate with `resetPasswordSchema`.
    2. Find user by `resetToken` where `resetTokenExp > now()`.
    3. If not found or expired → 400 error.
    4. Hash new password, update user, clear `resetToken` and `resetTokenExp`.
    5. Return success.

- [ ] **5.4 — Forgot Password Page** (`app/(auth)/forgot-password/page.tsx`)
  - UI matching the **Forgot Password** design.
  - On success: show toast with message, display the reset token (for testing).

- [ ] **5.5 — Reset Password Page** (`app/(auth)/reset-password/page.tsx`)
  - UI matching the **Reset Password** design.
  - Read token from URL query param (`?token=xxx`).
  - On success: show toast, redirect to `/login`.

- [ ] **5.6 — Auth.js Middleware** (`middleware.ts`)
  - Export Auth.js middleware from `auth.config.ts`:
    ```typescript
    import authConfig from "./auth.config";
    import NextAuth from "next-auth";
    export default NextAuth(authConfig).auth;
    export const config = {
      matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
    };
    ```
  - The `authorized` callback in `auth.config.ts` (Phase 4.2) handles:
    - Unauthenticated → redirect to `/login`.
    - Authenticated on auth pages → redirect to `/products`.
  - Auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`) must be publicly accessible — handled by the callback logic.

- [ ] **5.7 — Session Provider & Auth Hook**
  - Wrap root layout with `SessionProvider` from `next-auth/react`.
  - Use `useSession()` hook in client components (Navbar, UserMenu) for user state.
  - Use `await auth()` from `@/auth` in Server Components to get the session.
  - Use `signOut()` from `next-auth/react` for logout.
  - **No custom `/api/auth/me` route needed** — Auth.js provides this via its built-in session endpoint.

### Verification

- Forgot password → returns reset token.
- Reset password with valid token → password updated → can login with new password.
- Reset password with expired/invalid token → error shown.
- Unauthenticated user visiting `/products` → redirected to `/login`.
- Authenticated user visiting `/login` → redirected to `/products`.
- Navbar shows "Login" when unauthenticated, user dropdown when authenticated.
- `useSession()` returns correct user data in client components.
- `await auth()` returns correct session in Server Components.

---

## Phase 6 — Products Listing & Product Details

> **Goal**: Display products from the database in a responsive grid with search, sort, pagination, and a detail view.

### Tasks

- [ ] **6.1 — Products API** (`app/api/products/route.ts`)
  - `GET` handler with query params:
    - `search` (string) — filters by title (case-insensitive `contains`).
    - `sort` (string) — `price_asc`, `price_desc`, `title_asc`, `title_desc`, `newest`.
    - `page` (number, default 1).
    - `limit` (number, default 12).
  - Returns: `{ success: true, data: { products: Product[], pagination: { page, limit, total, totalPages } } }`.

- [ ] **6.2 — Single Product API** (`app/api/products/[id]/route.ts`)
  - `GET` handler: Fetch product by ID. Return 404 if not found.

- [ ] **6.3 — Products Page** (`app/(main)/products/page.tsx`)
  - Server Component for initial data fetch (SEO-friendly).
  - UI matching the **Products** design:
    - "Our Products" heading in blue.
    - `SearchBar` component (right-aligned) with placeholder "Search by user & order ID".
    - `SortDropdown` component with options: Newest, Price: Low to High, Price: High to Low, Name: A–Z, Name: Z–A.
    - 4-column responsive product grid (4 cols desktop, 3 cols tablet, 2 cols mobile, 1 col small mobile).
    - Each card uses `ProductCard` component.
    - `Pagination` component at the bottom.
  - Client Component wrapper for search/sort/pagination interactivity.
  - Update URL search params on filter change (for shareable URLs).

- [ ] **6.4 — Product Detail Page** (`app/(main)/products/[id]/page.tsx`)
  - Server Component.
  - Display:
    - Large product image (using `next/image`, optimized).
    - Title, full description, price.
    - Color badge (if applicable).
    - Size display (if applicable).
    - `QuantitySelector` component.
    - "Add to Cart" button (blue, full-width or prominent).
  - Handle invalid ID → `notFound()`.

- [ ] **6.5 — (main) Layout** (`app/(main)/layout.tsx`)
  - Render `Navbar` at top.
  - Render `children` as main content.
  - Optional `Footer` at bottom.
  - Wraps all authenticated pages.

- [ ] **6.6 — Add to Cart Action (from Product pages)**
  - When "Add to Cart" is clicked on `ProductCard` or product detail:
    - Call `POST /api/cart` with `{ productId, quantity }`.
    - Show success toast: "Added to cart!".
    - If user not authenticated, middleware auto-redirects to login.

### Verification

- Products page loads with 15–20 seeded products in a 4-column grid.
- Search filters products by title in real-time.
- Sort reorders products correctly.
- Pagination works (navigate between pages).
- Product detail page shows full product info.
- "Add to Cart" calls the API successfully (API tested via curl/Postman if cart page isn't built yet).
- Invalid product ID shows 404 not-found page.

---

## Phase 7 — Cart System

> **Goal**: Full cart CRUD with quantity controls, delete confirmation modal, price calculations, and order placement.

### Tasks

- [ ] **7.1 — Cart API** (`app/api/cart/route.ts`)
  - `GET`: Fetch all cart items for the authenticated user (include product details via Prisma `include`).
  - `POST`: Add item to cart. Body: `{ productId, quantity }`. If item already exists, increment quantity.
  - `PATCH`: Update item quantity. Body: `{ cartItemId, quantity }`. If quantity ≤ 0, delete the item.
  - `DELETE`: Remove item from cart. Body: `{ cartItemId }`.
  - All routes require authentication — use `await auth()` from `@/auth` to get session, return 401 if null.

- [ ] **7.2 — Cart Page** (`app/(main)/cart/page.tsx`)
  - Client Component (heavy interactivity).
  - UI matching the **Cart** design:
    - "← Your Shopping Bag" heading with back arrow (navigates to `/products`).
    - **Cart table** with columns:
      - Checkbox (select for bulk actions — optional but matches design).
      - Product: thumbnail image + product title (2-line).
      - Color: colored dot + color name.
      - Size: size value.
      - Qty: `QuantitySelector` (−/value/+).
      - Price: formatted as `$XX.XX`.
      - Actions: red delete (trash) icon button.
    - **Summary section** (right-aligned below table):
      - Sub Total: sum of (price × qty) for all items.
      - Tax: calculated as a percentage (e.g., 10% of subtotal).
      - Total: subtotal + tax.
    - **"Place Order" button** (blue, prominent).
  - **Interactions**:
    - Changing quantity via ± → calls `PATCH /api/cart` → updates price in real-time.
    - Clicking delete icon → opens `ConfirmDialog` ("Are You Sure You Want To Delete The Item!") with warning icon, "No" / "Yes" buttons.
    - Confirming delete → calls `DELETE /api/cart` → removes row → shows toast.
    - "Place Order" → calls `POST /api/orders` → shows green success toast ("Awesome, Your order has been placed successfully.") → clears cart.
  - **Empty state**: If cart is empty, show `EmptyState` with message and link to products.

- [ ] **7.3 — Orders API** (`app/api/orders/route.ts`)
  - `POST`: Create order from current cart.
    1. Fetch all cart items for user (with product prices).
    2. If cart is empty → 400 error.
    3. Calculate subtotal, tax (10%), total.
    4. Create `Order` with `OrderItem` records (snapshot the price at time of order).
    5. Clear all user's cart items.
    6. Return the created order.
  - `GET`: List all orders for authenticated user. Support `page` and `limit` query params. Return newest first.

### Verification

- Cart page shows all items added from products page.
- Quantity ± updates the quantity and recalculates totals.
- Delete icon opens confirmation modal. "No" closes it. "Yes" removes the item.
- "Place Order" creates an order, clears the cart, shows success toast.
- Empty cart shows empty state.
- Totals calculate correctly (subtotal, tax, total).

---

## Phase 8 — Orders System

> **Goal**: Order history listing with pagination and order detail view.

### Tasks

- [ ] **8.1 — Single Order API** (`app/api/orders/[id]/route.ts`)
  - `GET`: Fetch order by ID for the authenticated user. Include order items with product details. Return 404 if not found or doesn't belong to user.

- [ ] **8.2 — Orders Page** (`app/(main)/orders/page.tsx`)
  - Server Component (or hybrid).
  - Display order history in a **table**:
    - Columns: Order ID (truncated UUID), Date, Items Count, Total, Status (badge), Actions (View link).
    - Newest orders first.
    - `Pagination` at bottom.
  - Empty state if no orders.

- [ ] **8.3 — Order Detail Page** (`app/(main)/orders/[id]/page.tsx`)
  - Server Component.
  - Display:
    - Order ID, date, status badge.
    - **Items table**: product image, title, quantity, unit price, line total.
    - **Summary**: subtotal, tax, total.
  - Handle invalid ID → `notFound()`.

- [ ] **8.4 — Navbar Cart Badge**
  - Update `Navbar` to show a small count badge on the cart icon indicating the number of items in the cart.
  - Fetch cart count via API or server-side.

### Verification

- After placing an order, it appears in the orders list.
- Order detail page shows all items, quantities, prices, and totals.
- Order status badge renders with correct color (PENDING = yellow, DELIVERED = green, etc.).
- Pagination works on orders list.
- Invalid order ID shows 404.

---

## Phase 9 — Polish: Error States, Loading, Empty States, Responsiveness & Accessibility

> **Goal**: Production-level polish. Every edge case has a graceful UI. The app is fully responsive and accessible.

### Tasks

- [ ] **9.1 — Loading States**
  - Add `loading.tsx` files for each route group:
    - `app/(main)/products/loading.tsx` — grid of `Skeleton` cards (4-column grid of card placeholders).
    - `app/(main)/cart/loading.tsx` — skeleton table rows.
    - `app/(main)/orders/loading.tsx` — skeleton table rows.
    - `app/(main)/products/[id]/loading.tsx` — skeleton for product detail (large image placeholder + text blocks).
    - `app/(main)/orders/[id]/loading.tsx` — skeleton for order detail.
  - Button loading states: all form submit buttons show `Spinner` + disabled state while requests are in-flight.

- [ ] **9.2 — Error States**
  - Add `error.tsx` files for each route group:
    - Display a friendly error message with "Try Again" button.
    - Client Component (Next.js requirement for error boundaries).
  - Add `app/not-found.tsx` — global 404 page with illustration and "Go Home" link.
  - Add `not-found.tsx` for product/order detail pages.
  - Handle API failures gracefully on client: show toast with error message, don't crash.

- [ ] **9.3 — Empty States**
  - Products page: "No products found" when search yields no results (with suggestion to clear filters).
  - Cart page: "Your cart is empty" with illustration and "Browse Products" button.
  - Orders page: "No orders yet" with "Start Shopping" button.
  - Order detail: handled by 404 if not found.

- [ ] **9.4 — Responsive Design**
  - **Navbar**: Collapse to hamburger menu on mobile. Slide-out drawer or dropdown.
  - **Product grid**: 4 cols → 3 cols → 2 cols → 1 col across breakpoints.
  - **Cart table**: Horizontal scroll on mobile OR reformat to card-based layout for small screens.
  - **Forms (auth)**: Full-width on mobile, max-width card on desktop (already handled by `AuthLayout`).
  - **Orders table**: Horizontal scroll on mobile.
  - **Modals**: Full-screen on mobile, centered card on desktop.
  - Test at breakpoints: 320px, 375px, 768px, 1024px, 1440px.

- [ ] **9.5 — Accessibility**
  - All `Input` components have associated `<label>` elements (already wired via `htmlFor`/`id`).
  - All interactive elements are keyboard-navigable (tab order).
  - Focus visible states on all buttons, links, inputs (outline ring on focus).
  - Modal focus trap (already implemented in Phase 3, verify).
  - `aria-label` on icon-only buttons (cart icon, delete icon, ± buttons).
  - `aria-live="polite"` on toast container for screen reader announcements.
  - Semantic HTML: `<nav>`, `<main>`, `<header>`, `<footer>`, `<table>`, `<form>`.
  - `alt` text on all `<img>` / `next/image` elements.

- [ ] **9.6 — Performance**
  - Ensure all product images use `next/image` with proper `width`, `height`, `sizes`, and `priority` (for above-fold).
  - Verify Server Components are used wherever possible (pages that don't need interactivity).
  - Lazy load components below the fold if needed (`React.lazy` + `Suspense` or dynamic imports).
  - Memoize expensive computations (cart totals) with `useMemo`.
  - Use `React.memo` on `ProductCard` to prevent unnecessary re-renders in the grid.

- [ ] **9.7 — Final Review & Cleanup**
  - Remove any `console.log` statements.
  - Ensure no `any` types remain in TypeScript.
  - Run `npm run lint` and fix all linting errors.
  - Run `npm run build` to verify production build succeeds.
  - Test the complete user flow end-to-end:
    1. Register → Login → Browse Products → Search/Sort → View Product Detail → Add to Cart → View Cart → Update Quantity → Remove Item → Place Order → View Orders → View Order Detail → Logout.

### Verification

- Every page has a loading skeleton that appears during data fetch.
- Every error scenario shows a friendly error UI (not a blank screen or crash).
- Every empty list shows a meaningful empty state.
- App is fully usable on mobile (320px width).
- Keyboard-only navigation works through the entire flow.
- `npm run build` succeeds with zero errors.
- Lighthouse accessibility score ≥ 90.

---

## Phase 10 — Structured Logging with Pino

> **Goal**: Add structured server-side logging using Pino with pino-pretty for human-readable terminal output in development. Provide a centralized logger module and integrate it across all API routes and server-side logic.

### Tasks

- [ ] **10.1 — Install Dependencies**
  - Install `pino` as a production dependency.
  - Install `pino-pretty` as a dev dependency.
    ```bash
    npm install pino
    npm install -D pino-pretty
    ```

- [ ] **10.2 — Logger Module** (`lib/logger.ts`)
  - Create a centralized Pino logger instance:
    ```typescript
    import pino from "pino";

    export const logger = pino({
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
            }
          : undefined,
    });
    ```
  - **Development**: Uses `pino-pretty` transport for colorized, human-readable output with timestamps.
  - **Production**: Uses Pino's default JSON output (suitable for log aggregation tools like Datadog, ELK, etc.).
  - Add `LOG_LEVEL` to `.env.example` with default `info`.

- [ ] **10.3 — Request Logging Utility** (`lib/request-logger.ts`)
  - Create a reusable helper for logging API route requests:
    ```typescript
    import { NextRequest } from "next/server";
    import { logger } from "./logger";

    export function logRequest(req: NextRequest, context?: string) {
      logger.info(
        {
          method: req.method,
          url: req.nextUrl.pathname,
          search: req.nextUrl.search || undefined,
          context,
        },
        `${req.method} ${req.nextUrl.pathname}`
      );
    }

    export function logError(error: unknown, context?: string) {
      logger.error({ err: error, context }, context || "Unhandled error");
    }
    ```

- [ ] **10.4 — Integrate Logger into API Routes**
  - Replace all `console.log` / `console.error` calls across API routes with `logger.info()` / `logger.error()` / `logger.warn()`.
  - Add `logRequest()` at the top of each API route handler.
  - Add `logError()` in every `catch` block.
  - Target files:
    - `app/api/auth/register/route.ts`
    - `app/api/auth/forgot-password/route.ts`
    - `app/api/auth/reset-password/route.ts`
    - `app/api/products/route.ts`
    - `app/api/products/[id]/route.ts`
    - `app/api/cart/route.ts`
    - `app/api/orders/route.ts`
    - `app/api/orders/[id]/route.ts`

- [ ] **10.5 — Log Key Application Events**
  - Auth events: successful login, failed login attempt, registration, password reset request/completion.
  - Cart events: item added, quantity updated, item removed.
  - Order events: order placed (with order ID and total).
  - Use appropriate log levels:
    - `info` — successful operations, request handling.
    - `warn` — validation failures, auth failures, expired tokens.
    - `error` — unhandled exceptions, DB errors.

- [ ] **10.6 — Update Folder Structure & Documentation**
  - Add `lib/logger.ts` and `lib/request-logger.ts` to the folder structure in the Shared Architecture section.
  - Update `.env.example` with `LOG_LEVEL=info`.

### Verification

- `npm run dev` shows colorized, human-readable logs in the terminal via pino-pretty.
- Every API request logs method, path, and relevant context.
- Errors log full error objects with stack traces.
- No `console.log` or `console.error` calls remain in server-side code.
- `npm run build` succeeds (pino-pretty is dev-only, not bundled).
- Setting `LOG_LEVEL=debug` increases log verbosity; `LOG_LEVEL=warn` reduces it.

---

## Dependency Graph

```
Phase 1 (Foundation)
  └── Phase 2 (Database)
        ├── Phase 3 (UI Components)
        │     ├── Phase 4 (Auth: Register/Login)
        │     │     └── Phase 5 (Auth: Forgot/Reset + Middleware)
        │     │           └── Phase 6 (Products)
        │     │                 └── Phase 7 (Cart)
        │     │                       └── Phase 8 (Orders)
        │     │                             └── Phase 9 (Polish)
        │     │                                   └── Phase 10 (Logging)
```

> **Rule**: Never skip a phase. Each phase assumes all prior phases are complete and verified.

---

## Risk Register

| Risk                                          | Impact                   | Mitigation                                                                                        |
| --------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| PostgreSQL not running locally                | Blocks Phase 2+          | Document setup instructions. Consider Docker Compose for DB.                                      |
| AUTH_SECRET leaked in .env commit             | Security breach          | `.env` in `.gitignore`. Use `.env.example` for docs. Generated via `npx auth secret`.             |
| Prisma client not singleton in dev            | DB connection exhaustion | `lib/db.ts` singleton pattern (implemented in Phase 2).                                           |
| Prisma adapter not Edge-compatible            | Middleware crash         | Split auth config: `auth.config.ts` (Edge-safe, no Prisma) + `auth.ts` (full config with Prisma). |
| Product images from external domains blocked  | Broken images            | Configure `next.config.ts` `images.remotePatterns`.                                               |
| Cart race conditions (concurrent qty updates) | Incorrect totals         | Use Prisma transactions for order placement. `@@unique` constraint prevents duplicate cart items. |
| Password reset token brute-force              | Account takeover         | Use long random tokens (UUID v4). Expire after 1 hour. Clear after use.                           |
| Large product datasets slow pagination        | Poor UX                  | DB indexes on searchable/sortable columns. Limit page size.                                       |

---

## Conventions & Standards

- **File naming**: kebab-case for files, PascalCase for components.
- **Imports**: Use `@/` path alias (configured in `tsconfig.json`).
- **Types**: All props interfaces defined at the top of component files or in `types/`.
- **API routes**: Always validate input with Zod. Always return the standard response shape.
- **Error handling**: `try/catch` in every API route. Never expose raw error messages to client.
- **Commits**: One commit per phase (or logical sub-task within a phase).
- **No `any`**: Every variable, parameter, and return type must be explicitly typed.
- **No unused imports/variables**: ESLint will catch these — fix before committing.
