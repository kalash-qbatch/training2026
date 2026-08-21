# Bhai ka Store — Mukammal Repository Documentation (Roman Urdu + Technical English)

> **Developer-Grade Technical Reference Manual & Architectural Overview**  
> _Yeh document poore codebase ki step-by-step aur file-by-file tafseel faraham karta hai taake koi bhi developer zero prior context ke sath is project ko mukammal samajh, chala, aur extend kar sake._

---

## Table of Contents (Fehrist)

1. [Project Overview (Project ka Khulasa)](#1-project-overview-project-ka-khulasa)
2. [Repository Structure (Folder aur File Structure)](#2-repository-structure-folder-aur-file-structure)
3. [Dependencies (Packages aur Libraries)](#3-dependencies-packages-aur-libraries)
4. [File-by-File Breakdown (Har File ki Tafseel)](#4-file-by-file-breakdown-har-file-ki-tafseel)
   - [Configuration & Build Files](#41-configuration--build-files)
   - [Database & Migrations (`prisma/`)](#42-database--migrations-prisma)
   - [Type Definitions (`types/`)](#43-type-definitions-types)
   - [Custom Hooks (`hooks/`)](#44-custom-hooks-hooks)
   - [Scripts (`scripts/`)](#45-scripts-scripts)
   - [Core Libraries & Business Logic (`lib/`)](#46-core-libraries--business-logic-lib)
   - [Next.js App Router Pages & API Routes (`app/`)](#47-nextjs-app-router-pages--api-routes-app)
   - [UI & Feature Components (`components/`)](#48-ui--feature-components-components)
5. [Entry Point & Execution Flow (System Start aur Flow)](#5-entry-point--execution-flow-system-start-aur-flow)
6. [Architecture & Data Flow Diagram (Mermaid Diagram)](#6-architecture--data-flow-diagram-mermaid-diagram)
7. [Configuration & Environment Variables (`.env`)](#7-configuration--environment-variables-env)
8. [API Endpoints Reference (Backend REST API)](#8-api-endpoints-reference-backend-rest-api)
9. [Database Schema & ER Diagram](#9-database-schema--er-diagram)
10. [Setup & Run Instructions (Chalanay ka Tareeqa)](#10-setup--run-instructions-chalanay-ka-tareeqa)
11. [Known Issues, Edge Cases & Decisions](#11-known-issues-edge-cases--decisions)

---

## 1. Project Overview (Project ka Khulasa)

### Project Kya Karta Hai (Purpose & Problem Solved)

**Bhai ka Store** ek full-stack, enterprise-grade e-commerce web application hai jo modern web standards par bani hai. Is application ke 2 main hissay (modules) hain:

1. **Customer Storefront**: Jahan customers products browse kar sakte hain, categories/colors/sizes ke hisaab se filter kar sakte hain, cart manage kar sakte hain, order place kar sakte hain, aur real-time notifications dekh sakte hain.
2. **Admin Portal**: Jahan store managers products add/edit/delete (soft-delete) kar sakte hain, Supabase CDN par multiple product images upload kar sakte hain, CSV file ke zariye bulk products import kar sakte hain, aur customer orders ka lifecycle status (Pending -> Processing -> Shipped -> Delivered / Cancelled) update kar sakte hain.

### Tech Stack Summary

- **Core Framework**: Next.js 16.2.12 (App Router, Server Components, Route Handlers, Turbopack)
- **Language**: TypeScript 5 (Strict Mode enabled)
- **UI Library**: React 19.2.4 & React DOM 19.2.4
- **Database & ORM**: PostgreSQL database ke sath Prisma ORM 7.9.1 (Driver Adapter `@prisma/adapter-pg` aur connection pool ke liye `pg` library)
- **Authentication**: NextAuth.js v5 beta (`next-auth@5.0.0-beta.32` & `@auth/prisma-adapter`) — Email/Password Credentials aur Google/GitHub OAuth ke sath
- **Cloud Media Storage**: Supabase Storage (`@supabase/supabase-js`) — Product images direct cloud par upload aur host karne ke liye
- **State Management**: Zustand 5.0.14 (with `persist` local-storage middleware)
- **Forms & Validation**: React Hook Form 7.84.0 + Zod 4.4.3 (`@hookform/resolvers`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`, `clsx`, `tailwind-merge`)
- **Icons**: Lucide React (`lucide-react`)
- **Logging**: Pino 10.3.1 structured JSON logging + `pino-pretty` (dev mode formatting)
- **Email Delivery**: Nodemailer 9.0.3 (SMTP ke zariye Password Reset emails bhejne ke liye)

### High-Level Architecture Pattern

Project mein **Layered Clean Architecture** use ki gayi hai:

- **Presentation Layer (`app/` & `components/`)**: React Server Components aur Client Components jo UI render karte hain.
- **State Layer (`lib/store/`)**: Zustand stores jo client-side cart aur auth session state ko manage aur synchronize karte hain.
- **API Client Layer (`lib/api/`)**: Browser-safe fetch functions jo backend API endpoints ko call karte hain.
- **Transport / Route Handler Layer (`app/api/`)**: Next.js Route Handlers jo HTTP requests receive karke direct backend controllers ko call karte hain.
- **Controller Layer (`lib/controllers/`)**: Business orchestration layer jo authorization (`requireUser`, `requireAdminUser`), Zod validation, aur error formatting handle karti hai.
- **Domain Service Layer (`lib/services/`)**: Pure business logic, atomic Prisma database transactions, inventory deductions, aur email/notification creation.
- **Persistence Layer (`lib/db.ts` & `prisma/`)**: Prisma Client singleton instance with PostgreSQL connection pooling.

---

## 2. Repository Structure (Folder aur File Structure)

```text
next_app_fullstack/
├── .env                              # Environment variables (DB URL, Secrets, OAuth keys, SMTP)
├── AGENTS.md                         # AI agent rules & workspace guidelines
├── IMPLEMENTATION_PLAN.md            # Historic design specifications & roadmap
├── NOTES.md                          # Architecture notes & implementation decisions
├── README.md                         # High-level project summary
├── auth.config.ts                    # Edge-compatible NextAuth routing rules & RBAC authorization
├── auth.ts                           # NextAuth full Node.js config, JWT lifecycle, & providers
├── eslint.config.mjs                 # ESLint 9 configuration
├── next.config.ts                    # Next.js settings (Turbopack, remote images, allowed origins)
├── package.json                      # Dependencies & NPM scripts
├── postcss.config.mjs                # PostCSS config registering Tailwind CSS v4
├── proxy.ts                          # Edge proxy/middleware for session sync & route protection
├── tsconfig.json                     # TypeScript compiler configuration (strict mode)
├── app/                              # Next.js App Router root folder
│   ├── (auth)/                       # Auth route group (login, signup, password reset)
│   │   ├── forgot-password/page.tsx  # Forgot password UI page
│   │   ├── layout.tsx                # Auth pages ka centered card layout
│   │   ├── login/page.tsx            # Login page (Credentials + Social OAuth)
│   │   ├── register/page.tsx         # User registration page
│   │   └── reset-password/page.tsx   # Password reset with token page
│   ├── (main)/                       # Customer storefront route group
│   │   ├── layout.tsx                # Main customer layout with persistent Navbar
│   │   ├── cart/page.tsx             # Shopping cart & checkout page
│   │   └── products/                 # Products catalog routes
│   │       ├── [id]/page.tsx         # Server-rendered Product Detail Page (PDP)
│   │       └── page.tsx              # Product catalog grid & filter page
│   ├── admin/                        # Admin Portal route group (RBAC protected)
│   │   ├── layout.tsx                # Admin layout with Sidebar & TopBar
│   │   ├── page.tsx                  # Redirects to /admin/products
│   │   ├── orders/                   # Admin order management
│   │   │   ├── [orderId]/page.tsx    # Order detail & status transition view
│   │   │   └── page.tsx              # Admin orders table with search & pagination
│   │   └── products/                 # Admin product catalog management
│   │       └── page.tsx              # Products table, modal triggers, drawers
│   ├── api/                          # Backend REST API Route Handlers
│   │   ├── admin/                    # Admin-only endpoints
│   │   │   ├── categories/route.ts   # GET (list) / POST (create) categories
│   │   │   ├── orders/               # Admin orders API
│   │   │   │   ├── [id]/route.ts     # GET order detail / PATCH update status
│   │   │   │   └── route.ts          # GET all orders with search & pagination
│   │   │   ├── products/             # Admin products API
│   │   │   │   ├── [id]/route.ts     # PUT update / DELETE soft-delete product
│   │   │   │   ├── bulk/route.ts     # POST bulk import products from CSV
│   │   │   │   └── route.ts          # GET admin products / POST create product
│   │   │   └── upload/route.ts       # POST multipart image upload to Supabase
│   │   ├── auth/                     # Auth endpoints
│   │   │   ├── [...nextauth]/route.ts# NextAuth catch-all handler
│   │   │   ├── forgot-password/route.ts# POST generate reset token & send email
│   │   │   ├── register/route.ts     # POST register new user
│   │   │   └── reset-password/route.ts# GET validate token / POST apply new password
│   │   ├── cart/route.ts             # GET / POST / PATCH / DELETE user cart
│   │   ├── categories/route.ts       # GET public categories list
│   │   ├── notifications/            # Notifications API
│   │   │   ├── [id]/route.ts         # PATCH mark single notification read
│   │   │   └── route.ts              # GET notifications / PATCH mark all read
│   │   ├── orders/                   # Customer orders API
│   │   │   ├── [id]/route.ts         # GET customer order detail
│   │   │   └── route.ts              # GET customer orders / POST place order
│   │   └── products/                 # Public products API
│   │       ├── [id]/route.ts         # GET product by ID with variants
│   │       └── route.ts              # GET filtered/paginated products
│   ├── globals.css                   # Tailwind v4 theme, colors, CSS variables
│   ├── layout.tsx                    # Root HTML layout (Inter font, Providers, Toast)
│   ├── not-found.tsx                 # 404 Error page
│   ├── page.tsx                      # Root page (redirects to /products)
│   ├── robots.ts                     # Dynamic robots.txt generation
│   └── sitemap.ts                    # Dynamic sitemap.xml generator
├── components/                       # Reusable React components
│   ├── admin/                        # Admin Portal UI components
│   │   ├── AddMultipleProductsModal.tsx # CSV Bulk Upload modal with parsing & validation
│   │   ├── AdminPagination.tsx       # Reusable pagination bar for tables
│   │   ├── AdminSidebar.tsx          # Collapsible desktop/mobile admin sidebar
│   │   ├── AdminTopBar.tsx           # Admin header with notifications & profile
│   │   ├── DeleteConfirmModal.tsx    # Confirmation modal for deletions
│   │   ├── OrderDetailClient.tsx     # Admin order detail & status update view
│   │   ├── OrdersPageClient.tsx      # Admin order list with search & filter pills
│   │   ├── OrderStatusSelect.tsx     # Dropdown to change order status
│   │   ├── ProductDrawers.tsx        # Drawer forms to Create / Edit products
│   │   ├── ProductPreviewModal.tsx   # Modal to preview product storefront look
│   │   └── ProductsPageClient.tsx    # Admin products table orchestrator
│   ├── features/                     # Domain-specific feature components
│   │   ├── auth/                     # Authentication components
│   │   │   ├── AuthProvider.tsx      # NextAuth SessionProvider wrapper
│   │   │   ├── AuthSessionSync.tsx   # Syncs NextAuth session into Zustand store
│   │   │   ├── ForgotPasswordForm.tsx# Forgot password form
│   │   │   ├── LoginForm.tsx         # Login form (Credentials + OAuth)
│   │   │   ├── ResetPasswordForm.tsx # Reset password form with token check
│   │   │   ├── SignUpForm.tsx        # Registration form with validation
│   │   │   └── SocialAuthButtons.tsx # Google & GitHub sign-in buttons
│   │   ├── cart/                     # Shopping cart components
│   │   │   ├── CartLineItem.tsx      # Cart item row with quantity stepper
│   │   │   ├── CartPageClient.tsx    # Full cart page manager
│   │   │   ├── CartSummary.tsx       # Order subtotal, 10% tax, total calculation
│   │   │   ├── CartSync.tsx          # Syncs backend database cart on user login
│   │   │   ├── OrderPlacedModal.tsx  # Order confirmation modal
│   │   │   └── RemoveProductModal.tsx# Remove item confirmation dialog
│   │   ├── orders/                   # Customer orders components
│   │   │   ├── OrdersDrawer.tsx      # Slide-out customer order history drawer
│   │   │   └── OrdersTable.tsx       # Itemized table for past orders
│   │   └── products/                 # Storefront product components
│   │       ├── ProductCard.tsx       # Product card with hover effects & quick-add
│   │       ├── ProductGridSkeleton.tsx# Loading shimmer skeleton for products
│   │       └── ProductListing.tsx    # Catalog grid with search, filter, sort
│   ├── layout/                       # Shared layouts
│   │   ├── Footer.tsx                # Storefront footer
│   │   ├── Navbar.tsx                # Header with search, categories, cart & auth
│   │   ├── NotificationsPopover.tsx  # In-app notifications dropdown
│   │   └── UserMenu.tsx              # User profile avatar & dropdown menu
│   └── ui/                           # Base UI primitives
│       ├── Button.tsx                # Accessible multi-variant button
│       ├── Card.tsx                  # Rounded container card
│       ├── Drawer.tsx                # Slide-out drawer primitive
│       ├── EmptyState.tsx            # Visual empty placeholder with icon & CTA
│       ├── Input.tsx                 # Styled text input with error support
│       ├── Modal.tsx                 # Accessible dialog modal
│       ├── QtyStepper.tsx            # Quantity counter stepper
│       ├── Select.tsx                # Custom styled select dropdown
│       ├── SocialIcons.tsx           # Google & GitHub SVG logos
│       └── Toast.tsx                 # Global toast alert notification system
├── hooks/                            # Custom React hooks
│   ├── useOverlayTransition.ts       # Manages modal/drawer entrance & exit animations
│   └── useToast.ts                   # Hook to trigger toast notifications
├── lib/                              # Shared business logic, database & utilities
│   ├── admin.ts                      # Admin utility functions
│   ├── api/                          # Frontend fetch API clients
│   │   ├── admin.ts                  # Admin HTTP client calls
│   │   ├── auth.ts                   # Auth HTTP client calls
│   │   ├── cart.ts                   # Cart HTTP client calls
│   │   ├── notifications.ts          # Notifications HTTP client calls
│   │   ├── orders.ts                 # Orders HTTP client calls
│   │   └── products.ts               # Products HTTP client calls
│   ├── constants/                    # Application constants
│   │   ├── auth.ts                   # Session expiry & reset token constants
│   │   ├── index.ts                  # Constant re-exports
│   │   └── order.ts                  # 10% Tax rate & Page size constants
│   ├── controllers/                  # HTTP orchestration controllers
│   │   ├── admin-categories.ts       # Admin categories controller
│   │   ├── admin-orders.ts           # Admin orders controller
│   │   ├── admin-products.ts         # Admin products & CSV controller
│   │   ├── admin-upload.ts           # Admin image upload controller
│   │   ├── cart.ts                   # Cart controller
│   │   ├── categories.ts             # Public categories controller
│   │   ├── forgot-password.ts        # Forgot password controller
│   │   ├── http.ts                   # requireUser & requireAdminUser guards
│   │   ├── notifications.ts          # Notifications controller
│   │   ├── orders.ts                 # Orders controller
│   │   ├── products.ts               # Products controller
│   │   ├── register.ts               # User registration controller
│   │   └── reset-password.ts         # Password reset controller
│   ├── db.ts                         # Prisma Client singleton with connection pooling
│   ├── errors/                       # Custom domain error classes
│   │   └── products.ts               # Product-specific errors & HTTP statuses
│   ├── logger.ts                     # Pino logger setup
│   ├── mail.ts                       # Nodemailer SMTP transporter & templates
│   ├── mappers.ts                    # Prisma DB to TypeScript domain mappers
│   ├── product.ts                    # Variant & stock aggregation helpers
│   ├── request-logger.ts             # Request & error logging helpers
│   ├── services/                     # Core business logic & database queries
│   │   ├── auth.ts                   # User DB operations & password resets
│   │   ├── cart.ts                   # Cart DB operations & stock checks
│   │   ├── categories.ts             # Category DB queries
│   │   ├── notifications.ts          # Notification DB queries & triggers
│   │   ├── orders.ts                 # Transactional order placement & status updates
│   │   └── products.ts               # Product queries, filters, mutations, CSV import
│   ├── store/                        # Zustand state management stores
│   │   ├── useAuthStore.ts           # Local auth state store
│   │   └── useCartStore.ts           # Local cart state store (optimistic updates)
│   ├── supabase.ts                   # Supabase Storage client & bucket helpers
│   ├── utils.ts                      # Common utility functions (cn, formatCurrency, etc.)
│   └── validations/                  # Zod validation schemas
│       ├── admin.ts                  # Admin product, category, variant schemas
│       └── auth.ts                   # Auth & registration schemas
├── prisma/                           # Database ORM setup
│   ├── migrations/                   # SQL migration files
│   ├── schema.prisma                 # Declarative database models & relations
│   └── seed.ts                       # Database seeding script
├── public/                           # Static assets
│   ├── auth/                         # Auth background images
│   ├── products/                     # Local fallback product images
│   ├── templates/                    # products-template.csv for bulk upload
│   └── uploads/                      # Fallback upload directory
├── scripts/                          # Automation scripts
│   └── migrate-images-to-supabase.ts # Script to migrate local images to Supabase CDN
└── types/                            # Global TypeScript types
    ├── index.ts                      # Product, User, Order, Cart domain types
    └── next-auth.d.ts                # NextAuth session & JWT augmentations
```

---

## 3. Dependencies (Packages aur Libraries)

### Runtime Dependencies (`dependencies`)

| Package Name              | Version             | Yeh Kya Hai aur Kyun Use Hua Hai?                                                                  | Code Mein Kahan Use Hota Hai?                            |
| :------------------------ | :------------------ | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| `next`                    | `16.2.12`           | Next.js main framework jo App Router, SSR, Server Components aur Route Handlers provide karta hai. | Poore project mein                                       |
| `react` & `react-dom`     | `19.2.4`            | React 19 core UI rendering engine.                                                                 | Tamam components mein                                    |
| `@prisma/client`          | `^7.9.1`            | Type-safe ORM client jo PostgreSQL queries run karta hai.                                          | `lib/db.ts`, `lib/services/*`                            |
| `prisma`                  | `^7.9.1`            | Prisma CLI migrations aur schema generation ke liye.                                               | CLI / package.json scripts                               |
| `@prisma/adapter-pg`      | `^7.9.1`            | Prisma driver adapter jo node-postgres (`pg`) connection pool ko Prisma ke sath link karta hai.    | `lib/db.ts`, `prisma/seed.ts`                            |
| `pg`                      | `^8.22.0`           | Node.js PostgreSQL client jo efficient connection pooling provide karta hai.                       | `lib/db.ts`                                              |
| `next-auth`               | `^5.0.0-beta.32`    | Auth.js v5 authentication library jo Credentials aur OAuth sessions manage karti hai.              | `auth.ts`, `auth.config.ts`, `proxy.ts`                  |
| `@auth/prisma-adapter`    | `^2.11.3`           | NextAuth adapter jo OAuth accounts ko Prisma database mein save karta hai.                         | `auth.ts`                                                |
| `@supabase/supabase-js`   | `^2.112.0`          | Supabase official SDK jo product images ko Supabase Storage bucket par upload karta hai.           | `lib/supabase.ts`, `lib/controllers/admin-upload.ts`     |
| `bcryptjs`                | `^3.0.3`            | Password hashing library jo passwords ko securely hash aur compare karti hai.                      | `auth.ts`, `lib/controllers/register.ts`                 |
| `zod`                     | `^4.4.3`            | Schema validation library jo forms aur API payloads ko validate karti hai.                         | `lib/validations/*`, `lib/controllers/*`                 |
| `react-hook-form`         | `^7.84.0`           | Performant form handling library jo baghair faltu re-renders ke form state manage karti hai.       | `components/features/auth/*`, `components/admin/*`       |
| `@hookform/resolvers`     | `^5.7.1`            | React Hook Form aur Zod ka bridge resolver.                                                        | `components/features/auth/*`, `components/admin/*`       |
| `zustand`                 | `^5.0.14`           | Lightweight state management library with local-storage persistence.                               | `lib/store/useCartStore.ts`, `lib/store/useAuthStore.ts` |
| `nodemailer`              | `^9.0.3`            | SMTP email sending library jo password reset emails deliver karti hai.                             | `lib/mail.ts`                                            |
| `lucide-react`            | `^1.28.0`           | Modern, lightweight SVG icons library.                                                             | Tamam UI components mein                                 |
| `clsx` & `tailwind-merge` | `^2.1.1` / `^3.6.0` | Dynamic CSS classes ko safely merge karne ke liye utilities.                                       | `lib/utils.ts` (`cn` helper)                             |
| `pino`                    | `^10.3.1`           | Ultra-fast structured JSON logger for server-side logging.                                         | `lib/logger.ts`, `lib/request-logger.ts`                 |

---

## 4. File-by-File Breakdown (Har File ki Tafseel)

### 4.1. Configuration & Build Files

#### `next.config.ts`

- **Purpose**: Next.js ki global settings, Turbopack root, aur image optimization domains define karta hai.
- **Kese kaam karta hai**: `images.remotePatterns` mein Google avatars (`lh3.googleusercontent.com`), GitHub avatars (`avatars.githubusercontent.com`), Supabase CDN (`**.supabase.co`), aur Picsum images allow karta hai taake Next `<Image />` component optimize ho sake. Local LAN test ke liye `allowedDevOrigins` set karta hai.

#### `auth.config.ts`

- **Purpose**: Edge-compatible authentication rules aur Role-Based Access Control (RBAC) callbacks define karta hai.
- **Kese kaam karta hai**:
  - `pages`: Custom login page `/login` set karta hai.
  - `callbacks.authorized`: Route protection rules lagata hai:
    - Agar user logged in na ho aur private route access kare toh `/login` par bhej deta hai.
    - Agar non-admin user `/admin/*` access kare toh use `/products` par redirect kar deta hai.
    - Agar logged-in user `/login` ya `/register` par jaye toh admin ko `/admin/products` aur customer ko `/products` par bhej deta hai.
    - Agar admin user storefront routes (`/`, `/products`, `/cart`) par jaye toh automatically `/admin/products` par redirect ho jata hai.

#### `auth.ts`

- **Purpose**: NextAuth.js v5 ka main Node.js config file jo authentication lifecycle, database queries, aur JWT session management handle karta hai.
- **Kese kaam karta hai**:
  - `Credentials` provider: User ka email database mein find karta hai, `bcrypt.compare` se password verify karta hai, aur `rememberMe` flag check karta hai.
  - `Google` & `GitHub` providers: Social OAuth login facilitate karte hain.
  - `jwt` callback: Token mein `id`, `role`, `provider`, aur `rememberMe` save karta hai. Agar "Remember Me" checked ho toh session 48 hours chalta hai, warna 24 hours.
  - `session` callback: Client ko user ki `id`, `role`, aur expiry date provide karta hai.

#### `proxy.ts`

- **Purpose**: Next.js edge middleware/proxy jo har incoming request ko intercept karke session validate karta hai aur session cookies ko normalize karta hai.
- **Kese kaam karta hai**: `/api/auth/session` calls ko intercept karke fresh session JSON provide karta hai aur fixed `Set-Cookie` headers (HttpOnly, SameSite=Lax, Secure) ensure karta hai.

---

### 4.2. Database & Migrations (`prisma/`)

#### `prisma/schema.prisma`

- **Purpose**: PostgreSQL database ka complete schema, tables, relationships aur constraints define karta hai.
- **Models**:
  - `User`: User profile, role (`USER` ya `ADMIN`), password hash, password reset token aur expiry.
  - `Account`: OAuth accounts (Google/GitHub) ka NextAuth relation.
  - `Category`: Categories list (`name`, unique `slug`).
  - `Product`: Catalog product (`title`, `description`, `price`, `image`, `stock`, `isActive`, `categoryId`).
  - `ProductImage`: Product ki additional images with specific colors and sort order.
  - `Specification`: Product ke variants (`productId`, `color`, `size`, `qty`). Unique index `[productId, color, size]`.
  - `CartItem`: User ke cart line items (`userId`, `productId`, `specificationId`, `quantity`).
  - `Order`: Customer orders (`userId`, `status`, `subTotal`, `tax`, `total`).
  - `OrderItem`: Order ke andar har item ka snapshot (`price`, `color`, `size`, `productId`, `specificationId`).
  - `Notification`: User notifications (`userId`, `title`, `message`, `orderId`, `read`).
- **Enums**: `OrderStatus` (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REJECTED`).

#### `prisma/seed.ts`

- **Purpose**: Database ko initial default demo data se populate karta hai.
- **Kese kaam karta hai**: Existing data clean karta hai, 3 users banata hai (`kalash@qbatch.com`, `alex@example.com`, `admin@gmail.com`), 8 categories insert karta hai, 8 sample products with specifications banata hai, aur sample order/cart create karta hai.

---

### 4.3. Type Definitions (`types/`)

#### `types/index.ts`

- **Purpose**: Shared domain TypeScript types (`Product`, `ProductVariant`, `ProductImage`, `Category`, `User`, `CartItem`, `Order`, `OrderItem`, `OrderStatus`).

#### `types/next-auth.d.ts`

- **Purpose**: NextAuth ke `Session`, `User`, aur `JWT` interfaces ko extend karta hai taake custom properties (`id`, `role`, `provider`, `rememberMe`) type-safe ho jayein.

---

### 4.4. Custom Hooks (`hooks/`)

#### `hooks/useOverlayTransition.ts`

- **Purpose**: Modals, Drawers, aur Popovers ke smooth entrance aur exit CSS animations ko control karta hai. Component ko tab tak DOM mein rakhta hai jab tak exit animation mukammal na ho jaye.

#### `hooks/useToast.ts`

- **Purpose**: Toast context ko consume karne ke liye clean helper hook.

---

### 4.5. Scripts (`scripts/`)

#### `scripts/migrate-images-to-supabase.ts`

- **Purpose**: `public/products/` ki local images ko Supabase Storage bucket (`products`) mein upload karta hai aur database mein `Product.image` URLs ko public CDN URLs se replace kar deta hai.

---

### 4.6. Core Libraries & Business Logic (`lib/`)

#### `lib/db.ts`

- **Purpose**: Prisma Client ka singleton instance create karta hai jo `pg.Pool` connection pool use karta hai. Hot-reloading ke waqt naye database connections khulne se rokta hai taake PostgreSQL connection limit exhaust na ho.

#### `lib/supabase.ts`

- **Purpose**: Supabase administrative client initialize karta hai aur image upload function `uploadProductImage()` provide karta hai.

#### `lib/mail.ts`

- **Purpose**: Nodemailer transporter configure karta hai aur `sendPasswordResetEmail()` function ke zariye customer ko password reset link email bhejta hai.

#### `lib/utils.ts`

- **Purpose**: Common helper functions:
  - `cn()`: Tailwind classes ko safely merge karta hai.
  - `formatCurrency()`: Number ko currency string (e.g. `$28.00`) mein convert karta hai.
  - `formatDate()` & `formatRelativeTime()`: Timestamps ko readable date ya relative time (`Just now`, `5m ago`) mein convert karte hain.

#### `lib/mappers.ts`

- **Purpose**: Raw Prisma database rows ko clean frontend TypeScript domain objects mein transform karta hai (e.g. Decimal prices ko numbers mein convert karna, variant specifications se unique colors/sizes calculate karna).

#### `lib/product.ts`

- **Purpose**: Product variants matching logic (`findVariant`, `getAvailableSizes`, `getAvailableColors`).

#### `lib/constants/`

- **`auth.ts`**: Session timings (`SESSION_DURATION_HOURS = 24`, `REMEMBER_ME_DURATION_HOURS = 48`, `RESET_TOKEN_EXPIRY_MINUTES = 10`).
- **`order.ts`**: `TAX_RATE = 0.1` (10% sales tax) aur default `PAGE_SIZE = 8`.
- **`index.ts`**: Sub-constants ko re-export karta hai.

#### `lib/validations/`

- **`auth.ts`**: User signup (`signUpSchema`), login (`loginSchema`), aur password reset schemas (Zod).
- **`admin.ts`**: Admin product create/update (`adminProductSchema`), category schema, aur order status schemas.

#### `lib/store/`

- **`useAuthStore.ts`**: Zustand local auth state (`user`, `isAuthenticated`, `login`, `logout`) jo localStorage mein persist rehti hai.
- **`useCartStore.ts`**: Zustand shopping cart store jo local line items, quantities, subtotal, 10% tax, aur total calculate karta hai aur backend cart API ke sath synchronize hota hai.

#### `lib/api/` (Frontend Fetch Wrappers)

- `lib/api/products.ts`: Public products fetch karta hai (search, filters, sorting ke sath).
- `lib/api/cart.ts`: Cart items fetch, add, update, aur remove karta hai.
- `lib/api/orders.ts`: Customer orders load karta hai.
- `lib/api/notifications.ts`: Notifications fetch aur mark-as-read karta hai.
- `lib/api/auth.ts`: Register aur reset-password requests bhejta hai.
- `lib/api/admin.ts`: Admin product CRUD, CSV bulk upload, categories, images upload, aur order status updates handle karta hai.

#### `lib/services/` (Domain Business Logic & Database Queries)

- **`auth.ts`**: User registration, password reset token creation, unexpired token verification, aur password hash update karta hai.
- **`cart.ts`**: Cart line items ko database mein maintain karta hai aur available variant stock verify karta hai.
- **`categories.ts`**: Categories list aur create karta hai.
- **`notifications.ts`**: User notifications create aur query karta hai.
- **`orders.ts`**: **Transactional Order Placement (`createOrder`)** — Prisma transaction (`prisma.$transaction`) ke zariye inventory verify karta hai, `Order` aur `OrderItem` banata hai, stock minus karta hai, cart clean karta hai, aur notification trigger karta hai. `updateOrderStatus` order status badalta hai aur customer ko notification bhejta hai.
- **`products.ts`**: Public catalog search/filtering, admin product mutations, soft-deletion (`isActive = false`), aur CSV bulk import (`createProductsBulk`) execute karta hai.

#### `lib/controllers/` (HTTP Orchestration Layer)

- **`http.ts`**: `requireUser()` aur `requireAdminUser()` authentication guard functions jo session verify karti hain.
- **`register.ts`**: Signup payload validate karta hai, existing user check karta hai, bcrypt hash banata hai, aur user create karta hai.
- **`forgot-password.ts`**: Reset token (crypto random 32 bytes) banata hai, database mein uska SHA-256 hash save karta hai, aur email bhejta hai.
- **`reset-password.ts`**: SHA-256 token hash verify karta hai aur naya password update karta hai.
- **`cart.ts`**, **`products.ts`**, **`orders.ts`**, **`categories.ts`**, **`notifications.ts`**: Respective API routes ki request handling aur service integration.
- **`admin-products.ts`**, **`admin-orders.ts`**, **`admin-categories.ts`**, **`admin-upload.ts`**: Admin routes ki request handling aur file uploads.

---

### 4.7. Next.js App Router Pages & API Routes (`app/`)

#### Root Layout & Metadata

- **`app/layout.tsx`**: Global root layout jo Inter font, NextAuth `AuthProvider`, `AuthSessionSync`, `CartSync`, aur `ToastProvider` render karta hai.
- **`app/page.tsx`**: Default page jo seedha `/products` par redirect karta hai.
- **`app/not-found.tsx`**: Custom 404 page.
- **`app/robots.ts`** & **`app/sitemap.ts`**: Dynamic SEO robots aur sitemap generators.

#### Storefront Pages (`app/(main)/`)

- **`app/(main)/layout.tsx`**: Customer layout with persistent `Navbar`.
- **`app/(main)/products/page.tsx`**: Catalog page jahan `ProductListing` render hota hai.
- **`app/(main)/products/[id]/page.tsx`**: Server-Rendered Product Detail Page (PDP) jo dynamic OpenGraph tags, image gallery, variant selectors, live stock indicator, aur related products render karta hai.
- **`app/(main)/cart/page.tsx`**: Dedicated Cart & Checkout review page.

#### Auth Pages (`app/(auth)/`)

- **`app/(auth)/login/page.tsx`**: Login page (Credentials + Google/GitHub OAuth).
- **`app/(auth)/register/page.tsx`**: Signup page.
- **`app/(auth)/forgot-password/page.tsx`**: Forgot password request page.
- **`app/(auth)/reset-password/page.tsx`**: Reset password verification page.

#### Admin Portal Pages (`app/admin/`)

- **`app/admin/layout.tsx`**: Server-side RBAC guard jo non-admins ko rokta hai, aur `AdminSidebar` + `AdminTopBar` render karta hai.
- **`app/admin/products/page.tsx`**: Admin catalog table, product create/edit drawers, aur CSV bulk upload trigger.
- **`app/admin/orders/page.tsx`**: Admin orders table with search and filters.
- **`app/admin/orders/[orderId]/page.tsx`**: Order detail inspection aur status transition page.

#### API Route Handlers (`app/api/`)

Tamam endpoints HTTP requests receive karke unhein respective controllers ko bhejte hain (e.g. `app/api/cart/route.ts` -> `lib/controllers/cart.ts`).

---

### 4.8. UI & Feature Components (`components/`)

#### UI Primitives (`components/ui/`)

- **`Button.tsx`**: Multi-variant button (primary, secondary, outline, danger, ghost, loading spinner).
- **`Card.tsx`**: Styled rounded card container.
- **`Input.tsx`**: Form input with labels, icons, aur error text.
- **`Select.tsx`**: Styled dropdown selector.
- **`Modal.tsx`**: Accessible dialog modal with backdrop aur keyboard escape listener.
- **`Drawer.tsx`**: Slide-out drawer component.
- **`QtyStepper.tsx`**: Stock boundary checking stepper (`+` / `-`).
- **`EmptyState.tsx`**: Visual empty placeholder with CTA button.
- **`Toast.tsx`**: Global animated toast alerts (`success`, `error`, `warning`, `info`).
- **`SocialIcons.tsx`**: Google aur GitHub ke SVG logos.

#### Shared Layout Components (`components/layout/`)

- **`Navbar.tsx`**: Brand header, search bar, category tabs, cart drawer trigger with item badge, notifications popover, aur user menu.
- **`UserMenu.tsx`**: User avatar dropdown with orders drawer trigger aur logout.
- **`NotificationsPopover.tsx`**: Dropdown showing unread notification count, order alert list, aur mark-all-as-read button.
- **`Footer.tsx`**: Storefront footer.

#### Domain Feature Components (`components/features/`)

- **`auth/*`**: Login, Signup, Forgot Password, Reset Password forms, Social Auth buttons, aur session sync providers.
- **`cart/*`**: Cart line items, live quantity updates, 10% tax/subtotal calculation card, remove confirmation modal, aur order success modal.
- **`orders/*`**: Customer order history slide-out drawer aur itemized orders table.
- **`products/*`**: Product card with image zoom & stock badge, product listing grid with search & category filters, aur shimmer loading skeletons.

#### Admin Portal Components (`components/admin/`)

- **`AdminSidebar.tsx`** & **`AdminTopBar.tsx`**: Admin portal navigation scaffolding.
- **`ProductsPageClient.tsx`** & **`OrdersPageClient.tsx`**: Admin data tables with pagination and search.
- **`ProductDrawers.tsx`**: Slide-out form to create/edit products, multi-color variants, pricing, and images.
- **`AddMultipleProductsModal.tsx`**: CSV bulk upload modal with client-side CSV parsing, template download, and error preview.
- **`OrderDetailClient.tsx`** & **`OrderStatusSelect.tsx`**: Order inspection and lifecycle transition dropdown.

---

## 5. Entry Point & Execution Flow (System Start aur Flow)

### System Start & Flow

1. **Server Start**: Application `npm run dev` ya `npm run start` se start hoti hai.
2. **Edge Proxy (`proxy.ts`)**: Har request pehle proxy middleware se guzarti hai. Proxy user session token verify karta hai, RBAC check karta hai, aur unauthorized requests ko redirect karta hai.
3. **Root Layout (`app/layout.tsx`)**: HTML page render hota hai jo Inter fonts, NextAuth Session provider, Zustand Sync bridges (`AuthSessionSync`, `CartSync`), aur Toast alert container mount karta hai.

### Typical Order Placement Flow (Mermaid Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant Store as Zustand Cart Store
    participant Router as Next.js Route Handler (/api/orders)
    participant Ctrl as Orders Controller
    participant Service as Orders Service
    participant DB as PostgreSQL (Prisma)
    participant Notif as Notifications Service

    Customer->>Store: Clicks "Place Order"
    Store->>Router: POST /api/orders { items: [...] }
    Router->>Ctrl: placeOrder(body)
    Ctrl->>Ctrl: requireUser() (Validates Session JWT)
    Ctrl->>Service: createOrder(userId, items)

    rect rgb(240, 248, 255)
        note over Service,DB: Atomic Database Transaction
        Service->>DB: Check Product & Specification Stock
        alt Insufficient Stock (Stock Khatam Hai)
            DB-->>Service: Stock < Requested Qty
            Service-->>Ctrl: Throw OrderError("Insufficient stock", 400)
            Ctrl-->>Customer: 400 Bad Request Error
        else Stock Available Hai
            Service->>DB: Create Order Record (Status: PENDING)
            Service->>DB: Create OrderItems with Price Snapshots
            Service->>DB: Decrement Specification.qty & Product.stock
            Service->>DB: Delete purchased items from CartItem table
        end
    end

    Service->>Notif: createOrderNotification(userId, orderId, "Order Placed")
    Notif->>DB: Insert Notification Record
    Service-->>Ctrl: Return Order Object
    Ctrl-->>Router: { status: 200, body: { success: true, order } }
    Router-->>Customer: 200 OK
    Customer->>Store: clearLocal() (Cart Khali Karein)
    Customer->>Customer: Show OrderPlacedModal (Mubarakbaad)
```

---

## 6. Architecture & Data Flow Diagram (Mermaid Diagram)

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Layer (Browser)"]
        UI["React Server & Client Components (app/ & components/)"]
        Z_Auth["Zustand useAuthStore"]
        Z_Cart["Zustand useCartStore"]
        API_C["Frontend API Clients (lib/api/*)"]
    end

    subgraph Edge_Proxy ["Edge Proxy & Middleware"]
        Proxy["proxy.ts (Session Normalization & Route Gating)"]
        AuthConfig["auth.config.ts (RBAC Rules)"]
    end

    subgraph API_Layer ["API Layer (Next.js Route Handlers)"]
        Routes["app/api/* Route Handlers"]
    end

    subgraph Controller_Layer ["Controller Layer (lib/controllers/*)"]
        AuthCtrl["Auth & Password Controllers"]
        ProdCtrl["Product Controllers"]
        CartCtrl["Cart Controllers"]
        OrderCtrl["Order Controllers"]
        AdminCtrl["Admin Controllers"]
        HttpGuard["requireUser / requireAdminUser"]
    end

    subgraph Domain_Service_Layer ["Domain Service Layer (lib/services/*)"]
        AuthSvc["Auth Service (lib/services/auth.ts)"]
        ProdSvc["Product Service (lib/services/products.ts)"]
        CartSvc["Cart Service (lib/services/cart.ts)"]
        OrderSvc["Order Service (lib/services/orders.ts)"]
        NotifSvc["Notifications Service (lib/services/notifications.ts)"]
        MailSvc["Mail Service (lib/mail.ts)"]
    end

    subgraph External_Services ["External Cloud Services"]
        Supabase["Supabase Storage (Product Images CDN)"]
        SMTP["SMTP Email Server (Nodemailer)"]
    end

    subgraph Persistence_Layer ["Persistence Layer (Database)"]
        PrismaClient["Prisma Client Singleton (lib/db.ts)"]
        PG_Pool["PostgreSQL Connection Pool (pg.Pool)"]
        Database[("PostgreSQL Database")]
    end

    %% Flow Connections
    UI <--> Z_Auth
    UI <--> Z_Cart
    UI --> API_C
    API_C --> Proxy
    Proxy --> AuthConfig
    Proxy --> Routes
    Routes --> Controller_Layer
    Controller_Layer --> HttpGuard
    Controller_Layer --> Domain_Service_Layer
    AdminCtrl --> Supabase
    Domain_Service_Layer --> MailSvc
    MailSvc --> SMTP
    Domain_Service_Layer --> PrismaClient
    PrismaClient --> PG_Pool
    PG_Pool --> Database
```

---

## 7. Configuration & Environment Variables (`.env`)

| Variable Name                               | Zaroori Hai? (Required) | Default / Misaal                                    | Maqsad aur Description                                            |
| :------------------------------------------ | :---------------------- | :-------------------------------------------------- | :---------------------------------------------------------------- |
| `DATABASE_URL`                              | **Yes**                 | `postgresql://user:pass@localhost:5432/bhaikastore` | PostgreSQL database connection string.                            |
| `AUTH_SECRET`                               | **Yes**                 | 32+ characters random string                        | NextAuth JWT tokens ko sign aur encrypt karne ke liye secret key. |
| `NEXTAUTH_URL` / `AUTH_URL`                 | Optional                | `http://localhost:3000`                             | Application ka base URL (OAuth redirects aur emails ke liye).     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional                | `...`                                               | Google OAuth credentials.                                         |
| `GITHUB_ID` / `GITHUB_SECRET`               | Optional                | `...`                                               | GitHub OAuth credentials.                                         |
| `SUPABASE_URL`                              | **Yes**                 | `https://your-project.supabase.co`                  | Supabase project URL for Storage CDN.                             |
| `SUPABASE_SECRET_KEY`                       | **Yes**                 | `eyJhbGci...`                                       | Supabase Service Role key images upload karne ke liye.            |
| `SUPABASE_STORAGE_BUCKET`                   | Optional                | `products`                                          | Supabase bucket ka naam.                                          |
| `SMTP_HOST`                                 | **Yes**                 | `smtp.gmail.com`                                    | SMTP host password reset emails ke liye.                          |
| `SMTP_PORT`                                 | Optional                | `587`                                               | SMTP port (`587` TLS, `465` SSL).                                 |
| `SMTP_USER` / `SMTP_PASS`                   | **Yes**                 | `user@gmail.com` / `app-pass`                       | SMTP credentials.                                                 |
| `EMAIL_SENDER`                              | Optional                | `notifications@bhaikastore.com`                     | Email "From" address.                                             |
| `LOG_LEVEL`                                 | Optional                | `info`                                              | Pino log level (`debug`, `info`, `warn`, `error`).                |

---

## 8. API Endpoints Reference (Backend REST API)

| HTTP Method | API Path                    | Purpose (Maqsad)                       | Request Body / Params                                                        | Response Shape                                       | Auth Zaroori Hai? |
| :---------- | :-------------------------- | :------------------------------------- | :--------------------------------------------------------------------------- | :--------------------------------------------------- | :---------------- |
| `POST`      | `/api/auth/register`        | Naya user account banana               | `{ fullName, email, mobile, password, confirmPassword }`                     | `{ success: true, message, user }`                   | Public            |
| `POST`      | `/api/auth/forgot-password` | Password reset link request karna      | `{ email }`                                                                  | `{ success: true, message }`                         | Public            |
| `GET`       | `/api/auth/reset-password`  | Reset token check karna                | Query: `?token=...`                                                          | `{ success: true, valid: boolean }`                  | Public            |
| `POST`      | `/api/auth/reset-password`  | Naya password save karna               | `{ token, password, confirmPassword }`                                       | `{ success: true, message }`                         | Public            |
| `GET`       | `/api/auth/session`         | Current user session lena              | None                                                                         | `{ user: { ... }, expires }`                         | Public / Token    |
| `GET`       | `/api/products`             | Public products list (filtered/sorted) | Query: `?search=&sort=&page=&pageSize=&category=`                            | `{ success: true, products: [], total, totalPages }` | Public            |
| `GET`       | `/api/products/[id]`        | Single product ki detail lena          | Path: `id`                                                                   | `{ success: true, product: { ... } }`                | Public            |
| `GET`       | `/api/categories`           | Categories list lena                   | None                                                                         | `{ success: true, categories: [] }`                  | Public            |
| `GET`       | `/api/cart`                 | Logged-in user ka cart lena            | None                                                                         | `{ success: true, items: [] }`                       | **User** (401)    |
| `POST`      | `/api/cart`                 | Cart mein item add karna               | `{ productId, specificationId?, quantity }`                                  | `{ success: true, items: [] }`                       | **User** (401)    |
| `PATCH`     | `/api/cart`                 | Cart item quantity update karna        | `{ productId, specificationId?, quantity }`                                  | `{ success: true, items: [] }`                       | **User** (401)    |
| `DELETE`    | `/api/cart`                 | Cart se item delete karna              | `{ items: [{ productId, specificationId? }] }`                               | `{ success: true, items: [] }`                       | **User** (401)    |
| `GET`       | `/api/orders`               | Customer ke past orders lena           | Query: `?page=1&pageSize=5`                                                  | `{ success: true, orders: [], total }`               | **User** (401)    |
| `POST`      | `/api/orders`               | Checkout karke order place karna       | `{ items: [{ productId, specificationId?, quantity, price, color, size }] }` | `{ success: true, order: { ... } }`                  | **User** (401)    |
| `GET`       | `/api/orders/[id]`          | Single order ki detail lena            | Path: `id`                                                                   | `{ success: true, order: { ... } }`                  | **User** (401)    |
| `GET`       | `/api/notifications`        | User notifications lena                | Query: `?page=1&pageSize=8`                                                  | `{ success: true, notifications: [], unreadCount }`  | **User** (401)    |
| `PATCH`     | `/api/notifications`        | Sab notifications read mark karna      | None                                                                         | `{ success: true }`                                  | **User** (401)    |
| `PATCH`     | `/api/notifications/[id]`   | Single notification read karna         | Path: `id`                                                                   | `{ success: true }`                                  | **User** (401)    |
| `GET`       | `/api/admin/products`       | Admin product list                     | Query: `?search=&page=&pageSize=`                                            | `{ success: true, products: [], total }`             | **Admin** (403)   |
| `POST`      | `/api/admin/products`       | Naya product create karna              | FormData / JSON                                                              | `{ success: true, product, message }`                | **Admin** (403)   |
| `PUT`       | `/api/admin/products/[id]`  | Product update karna                   | FormData / JSON                                                              | `{ success: true, product, message }`                | **Admin** (403)   |
| `DELETE`    | `/api/admin/products/[id]`  | Product soft-delete karna              | Path: `id`                                                                   | `{ success: true, message }`                         | **Admin** (403)   |
| `POST`      | `/api/admin/products/bulk`  | CSV file se bulk products import       | FormData with `file`                                                         | `{ success: true, count, message }`                  | **Admin** (403)   |
| `GET`       | `/api/admin/orders`         | Admin orders list with search          | Query: `?search=&page=&pageSize=`                                            | `{ success: true, orders: [], total }`               | **Admin** (403)   |
| `GET`       | `/api/admin/orders/[id]`    | Admin order detail lena                | Path: `id`                                                                   | `{ success: true, order }`                           | **Admin** (403)   |
| `PATCH`     | `/api/admin/orders/[id]`    | Order status change karna              | `{ status: "PROCESSING"                                                      | "SHIPPED"                                            | ... }`            | `{ success: true, order, message }` | **Admin** (403) |
| `GET`       | `/api/admin/categories`     | Admin categories list                  | None                                                                         | `{ success: true, categories: [] }`                  | **Admin** (403)   |
| `POST`      | `/api/admin/categories`     | Nayi category banana                   | `{ name: string }`                                                           | `{ success: true, category, message }`               | **Admin** (403)   |
| `POST`      | `/api/admin/upload`         | Supabase par image upload karna        | FormData with `file`                                                         | `{ success: true, url, message }`                    | **Admin** (403)   |

---

## 9. Database Schema & ER Diagram

```mermaid
erDiagram
    User ||--o{ Account : "OAuth accounts"
    User ||--o{ CartItem : "owns"
    User ||--o{ Order : "places"
    User ||--o{ Notification : "receives"

    Category ||--o{ Product : "classifies"

    Product ||--o{ ProductImage : "multiple images"
    Product ||--o{ Specification : "variants matrix"
    Product ||--o{ CartItem : "in cart"
    Product ||--o{ OrderItem : "ordered"

    Specification ||--o{ CartItem : "variant in cart"
    Specification ||--o{ OrderItem : "variant ordered"

    Order ||--|{ OrderItem : "contains items"

    User {
        String id PK
        String fullName
        String email UK
        String phone
        String passwordHash
        String role "USER | ADMIN"
        String resetToken
        DateTime resetTokenExp
    }

    Product {
        String id PK
        String title
        String description
        Decimal price
        String image
        String color
        String size
        Int stock
        Boolean isActive
        String categoryId FK
    }

    Specification {
        String id PK
        String color
        String size
        Int qty
        String productId FK
    }

    CartItem {
        String id PK
        Int quantity
        String userId FK
        String productId FK
        String specificationId FK
    }

    Order {
        String id PK
        String userId FK
        OrderStatus status "PENDING | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REJECTED"
        Decimal subTotal
        Decimal tax
        Decimal total
    }

    OrderItem {
        String id PK
        Int quantity
        Decimal price
        String color
        String size
        String orderId FK
        String productId FK
        String specificationId FK
    }

    Notification {
        String id PK
        String userId FK
        String title
        String message
        String orderId
        Boolean read
    }
```

---

## 10. Setup & Run Instructions (Chalanay ka Tareeqa)

### Requirements

- **Node.js**: v18.18+ ya v20+ LTS
- **PostgreSQL**: v14+ (Local PostgreSQL ya Supabase / Neon Cloud)
- **NPM** ya **Yarn**

### 1. Packages Install Karein

```bash
npm install
```

### 2. Environment Variables (`.env`) Configure Karein

Root directory par `.env` file banayein aur ye values daalein:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bhaikastore"
AUTH_SECRET="koi_bhi_32_characters_ka_secret_key"
NEXTAUTH_URL="http://localhost:3000"
AUTH_URL="http://localhost:3000"

# Supabase Storage (Images ke liye)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SECRET_KEY="your-supabase-service-role-key"
SUPABASE_STORAGE_BUCKET="products"

# SMTP Settings (Password Reset email ke liye)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
EMAIL_SENDER="no-reply@bhaikastore.com"

LOG_LEVEL="info"
```

### 3. Database Migration aur Seeding

```bash
# Database tables banayein
npm run db:migrate

# Default demo data daalein
npm run db:seed
```

**Default Seed Users:**

- **Customer User**: `kalash@qbatch.com` / Password: `Password1!`
- **Customer User**: `alex@example.com` / Password: `Password1!`
- **Admin User**: `admin@gmail.com` / Password: `Admin/123` _(Login ke baad automatically `/admin/products` par bhej dega)_

### 4. Development Server Run Karein

```bash
npm run dev
```

Browser mein [http://localhost:3000](http://localhost:3000) open karein.

### 5. Production Build & Start

```bash
npm run build
npm run start
```

---

## 11. Known Issues, Edge Cases & Decisions

1. **Oversell Prevention (Atomic Transactions)**:
   - Order placement (`lib/services/orders.ts`) Prisma transaction (`prisma.$transaction`) ke andar chalta hai. Agar 2 users aakhri bachi hui item ko ek sath khareedne ki koshish karein toh database row lock ki wajah se pehla user successful hoga aur doosre ko `InsufficientStockError` (HTTP 400) milega, jisse inventory negative nahi hoti.
2. **Soft Deletes vs Foreign Keys**:
   - Admin jab product delete karta hai toh row database se delete nahi hoti balkay `Product.isActive = false` ho jati hai. Is se purane orders ka data intact rehta hai aur product storefront se foran hide ho jata hai.
3. **Database Connection Pooling in Next.js**:
   - Next.js development hot-reload pe connections exhaust na hon, isliye `lib/db.ts` mein Prisma Client ko global singleton pattern ke sath `pg.Pool` ke zariye manage kiya gaya hai.
4. **Password Reset Token Security**:
   - User ko plain token email mein jata hai, lekin database mein uska **SHA-256 hash** store hota hai jo 10 minutes baad expire ho jata hai. Database hack hone ki soorat mein bhi tokens misuse nahi ho sakte.

---

## Excluded Files Summary (Jo Files Shamil Nahi Hain)

Zail ki generated files aur binary assets ko line-by-line documentation se exclude kiya gaya hai:

- `package-lock.json`, `yarn.lock`, `skills-lock.json`, `tsconfig.tsbuildinfo` (Generated lockfiles & caches)
- `node_modules/` (Third-party packages)
- `public/products/*.jpg`, `public/auth/*.jpg` (Binary images)
- `.next/` (Next.js build output directory)

---

_Documentation generated for Bhai ka Store — Version 0.1.0 (Roman Urdu + English)_
