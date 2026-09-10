# Bhai ka Store

Bhai ka Store is a full-stack e-commerce application with a customer storefront, an
admin portal, card and cash-on-delivery checkout, real-time notifications, and a
separate background-job service.

The frontend and primary backend live in one Next.js application. Long-running and
delayed work is handled by the `jobs-scheduale/` FastAPI, Celery, Celery Beat, and
Redis service. The directory name is intentionally shown with its current spelling
throughout this document.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Frontend](#frontend)
- [Backend API](#backend-api)
- [Background jobs and schedules](#background-jobs-and-schedules)
- [Database](#database)
- [Scripts and tests](#scripts-and-tests)
- [Production checklist](#production-checklist)
- [Known setup caveats](#known-setup-caveats)

## Features

### Customer storefront

- Product catalog with search, category filters, sorting, pagination, and variant stock.
- Product details with image galleries, color/size selection, metadata, and JSON-LD.
- Authenticated cart with optimistic quantity updates and a 15-minute line-item TTL.
- Two-step checkout with shipping details, Stripe cards, saved payment methods, and COD.
- Order history, order details, payment retry, and reorder for cancelled orders.
- Credentials, Google, and Facebook authentication with optional remember-me sessions.
- Password reset by one-time token and email.
- In-app notifications over Socket.IO in local development and polling when sockets are off.

### Admin portal

- Role-protected product and order management.
- Product creation/editing, categories, variants, multiple images, and soft deactivation.
- CSV/XLSX bulk-product review and import with asynchronous progress polling.
- Search, status/category filters, pagination, order details, and controlled status updates.

### Platform services

- PostgreSQL persistence through Prisma and the `pg` driver adapter.
- Stripe PaymentIntents, saved cards, signed webhooks, and protected payment retries.
- Supabase Storage for product-image uploads.
- FastAPI job ingestion with Redis as the Celery broker and result backend.
- Celery workers for email, bulk imports, and unpaid-order cancellation.
- Celery Beat backup cancellation checks and a separate externally triggered payment cron.
- Structured Pino logging and automated Jest/Python tests.

## Technology stack

| Area               | Technology                                                             |
| ------------------ | ---------------------------------------------------------------------- |
| Web application    | Next.js 16.2.12 App Router, React 19.2.4, TypeScript 5                 |
| UI                 | Tailwind CSS 4, Inter, Lucide React, custom UI primitives              |
| Bulk import        | `xlsx` workbook parsing with CSV delimiter/header normalization        |
| Client state/forms | Zustand, React Hook Form, Zod                                          |
| Authentication     | Auth.js / NextAuth 5 beta, JWT sessions, credentials, Google, Facebook |
| Primary API        | Next.js Route Handlers and layered controllers/services                |
| Database           | PostgreSQL, Prisma 7.9.1, `@prisma/adapter-pg`, `pg`                   |
| Payments           | Stripe server SDK and Stripe Elements                                  |
| Product media      | Supabase Storage                                                       |
| Live updates       | Socket.IO with polling fallback                                        |
| Job API            | FastAPI and Pydantic                                                   |
| Queue/scheduler    | Celery, Celery Beat, Redis                                             |
| Job data access    | SQLAlchemy and psycopg2                                                |
| Email              | SMTP through Python `smtplib`; Nodemailer fallback for password reset  |
| Quality            | Jest, Testing Library, Python `unittest`, ESLint, Prettier, Husky      |

## Architecture

```mermaid
flowchart LR
    Browser[Browser] <-->|pages, REST, Socket.IO| Next["Next.js app<br/>custom dev server"]
    Next -->|Prisma| Postgres[(PostgreSQL)]
    Next -->|payments| Stripe[Stripe]
    Next -->|product images| Storage[Supabase Storage]
    Next -->|enqueue and inspect jobs| Jobs[FastAPI jobs API]
    Jobs --> Redis[("Redis broker<br/>and results")]
    Beat[Celery Beat] --> Redis
    Redis --> Worker[Celery worker]
    Worker --> Postgres
    Worker --> SMTP[SMTP provider]
    Stripe -->|signed webhook| Next
    Cron[External cron] -->|Bearer CRON_SECRET| Next
```

Request handling in the Next.js application is layered as follows:

```text
app/ and components/              React pages and UI
        ↓
lib/api/                          browser-safe fetch clients
        ↓
app/api/**/route.ts               HTTP transport
        ↓
lib/controllers/                  authentication, validation, response mapping
        ↓
lib/services/                     business rules and transactions
        ↓
lib/db.ts + prisma/               PostgreSQL persistence
```

The scheduler uses the same PostgreSQL database as Next.js. Prisma owns the schema
and migrations; the SQLAlchemy models in `jobs-scheduale/app/models.py` mirror that
schema for job execution.

## Repository layout

```text
.
├── app/                         Next.js pages, layouts, metadata, and API routes
│   ├── (auth)/                  login, registration, and password-reset pages
│   ├── (main)/                  storefront, cart, checkout, orders, saved cards
│   ├── admin/                   role-protected admin portal
│   └── api/                     primary backend route handlers
├── components/
│   ├── admin/                   admin product/order and bulk-upload UI
│   ├── features/                auth, cart, checkout, order, and product UI
│   ├── layout/                  navbar, user menu, and notifications
│   └── ui/                      shared primitives and loading skeletons
├── hooks/                       toast, overlay, and socket hooks
├── lib/
│   ├── api/                     frontend API clients
│   ├── controllers/             request validation and authorization
│   ├── services/                application and database business logic
│   ├── socket/                  Socket.IO client/server helpers
│   ├── store/                   Zustand auth and cart stores
│   └── validations/             Zod schemas
├── prisma/                      Prisma schema, migrations, and destructive demo seed
├── jobs-scheduale/              FastAPI/Celery/Redis background service
│   ├── app/main.py              internal job HTTP API
│   ├── app/celery_app.py        worker and Beat configuration
│   ├── app/tasks/               email, product, and order tasks
│   ├── tests/                   Python email-template tests
│   └── run.sh                   local all-in-one launcher
├── public/                      local assets and the product CSV template
├── scripts/                     SMTP, Stripe-flow, and image migration utilities
├── __tests__/                   Jest API, service, page, and component tests
├── .github/workflows/checks.yml JavaScript lint, typecheck, and build CI
├── auth.ts / auth.config.ts     Auth.js Node and edge-compatible configuration
├── server.ts                    custom local HTTP and Socket.IO server
├── instrumentation.ts           long-lived cart-expiration worker bootstrap
└── package.json                 JavaScript dependencies and commands
```

## Prerequisites

- Node.js 20.9 or newer. CI currently uses Node.js 22.
- npm (the repository includes `package-lock.json`).
- PostgreSQL. A local server or hosted PostgreSQL service such as Neon can be used.
- Python 3.10 or newer for the job service.
- Redis and the `redis-server` executable for local background jobs.
- An SMTP account for job-service startup and email delivery.
- Optional accounts for Stripe, Supabase Storage, Google OAuth, and Facebook OAuth.

## Getting started

### 1. Install the Next.js dependencies

```bash
npm ci
```

`postinstall` generates the Prisma client. Run `npm run db:generate` again whenever
`prisma/schema.prisma` changes.

### 2. Configure the Next.js environment

Start from the tracked example and then add the feature-specific variables shown
below. The current `.env.example` is only a partial template; the
[environment variable reference](#nextjs-environment) reflects the variables read by
the current source code.

```bash
cp .env.example .env
```

A practical full-feature local configuration has this shape:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

JOB_SCHEDULAR_URL="http://localhost:8000"
JOB_SCHEDULAR_INTERNAL_KEY="replace-with-the-same-value-as-INTERNAL_API_KEY"

STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
CRON_SECRET="replace-with-a-separate-random-secret"

SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace-with-a-service-role-key"
SUPABASE_STORAGE_BUCKET="products"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# Used only by the local password-reset fallback and SMTP test script.
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASSWORD="replace-with-an-smtp-password"
EMAIL_SENDER="user@example.com"

NEXT_PUBLIC_SOCKET_ENABLED="true"
LOG_LEVEL="info"
```

`AUTH_SECRET` can be generated locally with `openssl rand -base64 32`. Never commit
real environment files or service-role, Stripe, SMTP, cron, or internal API secrets.

### 3. Prepare the database

For a brand-new disposable development database, synchronize the current schema
directly:

```bash
npx prisma db push
```

The committed migration chain currently has a gap for newer payment fields, so a
clean `prisma migrate` replay is not yet reliable. See [Known setup
caveats](#known-setup-caveats) before using migrations for a new or production
database.

To load demo data, run the seed only against a disposable database:

```bash
npm run db:seed
```

> **Warning:** the seed first deletes all orders, cart items, products, categories,
> and users. It is not safe for shared, staging, or production data.

For an existing development database whose migration history is already established,
use:

```bash
npm run db:migrate
```

### 4. Configure the job service

Create `jobs-scheduale/.env`. This is a separate environment file; values from the
root `.env` are not automatically imported.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
REDIS_URL="redis://localhost:6379/0"
INTERNAL_API_KEY="replace-with-the-same-value-as-JOB_SCHEDULAR_INTERNAL_KEY"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASSWORD="replace-with-an-smtp-password"
EMAIL_SENDER="user@example.com"

APP_BASE_URL="http://localhost:3000"
PAYMENT_CANCEL_DELAY_SECONDS="300"
AUTO_CANCEL_HOURS="120"
AUTO_CANCEL_SCHEDULE_MINUTES="60"
```

The scheduler and Next.js must target the same database and schema, although their
connection URLs may differ if a provider exposes multiple endpoints. The scheduler's
`INTERNAL_API_KEY` must exactly match the root `JOB_SCHEDULAR_INTERNAL_KEY`.

### 5. Start the complete local stack

Start the scheduler first in one terminal:

```bash
cd jobs-scheduale
./run.sh
```

The script starts Redis when needed, creates `jobs-scheduale/venv` on first use,
installs Python requirements, and launches a Celery worker, Celery Beat, and FastAPI.
If the virtual environment already exists after requirements change, refresh it with
`venv/bin/pip install -r requirements.txt`.

Start Next.js in another terminal from the repository root:

```bash
npm run dev
```

Local services are then available at:

| Service            | URL                              |
| ------------------ | -------------------------------- |
| Storefront         | <http://localhost:3000/products> |
| Admin portal       | <http://localhost:3000/admin>    |
| Job-service health | <http://localhost:8000/health>   |
| FastAPI docs       | <http://localhost:8000/docs>     |
| Redis              | `localhost:6379`                 |

`npm run dev` uses `server.ts`, so local Socket.IO notifications are available at
`/api/socket/io`. `npm run dev:next` starts plain Next.js without that custom socket
server; set `NEXT_PUBLIC_SOCKET_ENABLED=false` when using it to use polling cleanly.

### Demo accounts

These accounts exist only after running the destructive seed:

| Role     | Email               | Password     |
| -------- | ------------------- | ------------ |
| Admin    | `admin@gmail.com`   | `Admin/123`  |
| Customer | `kalash@qbatch.com` | `Password1!` |
| Customer | `alex@example.com`  | `Password1!` |

Change or remove seeded credentials anywhere beyond isolated local development.

## Environment variables

### Next.js environment

| Variable                                             | Required when          | Purpose/default                                                                 |
| ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | Always                 | PostgreSQL connection used by Prisma, scripts, and seeds.                       |
| `AUTH_SECRET` or `NEXTAUTH_SECRET`                   | Always                 | Auth.js JWT/session signing secret.                                             |
| `AUTH_URL`, `NEXTAUTH_URL`                           | Recommended            | Public application and callback URL; local fallback is `http://localhost:3000`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | Google login           | Google OAuth application credentials.                                           |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`       | Facebook login         | Facebook OAuth application credentials.                                         |
| `STRIPE_SECRET_KEY`                                  | Card checkout          | Server-side Stripe API key.                                                     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                 | Card checkout          | Browser-safe Stripe Elements key.                                               |
| `STRIPE_WEBHOOK_SECRET`                              | Stripe webhook         | Verifies `POST /api/stripe/webhook`.                                            |
| `CRON_SECRET`                                        | Payment retry cron     | Bearer secret for `POST /api/cron/retry-payments`.                              |
| `SUPABASE_URL`                                       | Admin image uploads    | Supabase project URL.                                                           |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Admin image uploads    | Server-only storage credential.                                                 |
| `SUPABASE_STORAGE_BUCKET`                            | Optional               | Public product bucket; defaults to `products`.                                  |
| `JOB_SCHEDULAR_URL`                                  | Full job integration   | FastAPI base URL; defaults to `http://localhost:8000`.                          |
| `JOB_SCHEDULAR_INTERNAL_KEY`                         | Full job integration   | Value sent as `X-Internal-Key`. Set it explicitly.                              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`                | Local mail fallback    | Nodemailer connection; port defaults to `587`.                                  |
| `SMTP_PASS` or `SMTP_PASSWORD`                       | Local mail fallback    | Nodemailer password.                                                            |
| `EMAIL_SENDER`                                       | Optional fallback      | From address; falls back to `SMTP_USER`.                                        |
| `NEXT_PUBLIC_SOCKET_ENABLED`                         | Optional               | `true/1` forces sockets, `false/0` disables them; otherwise dev-only.           |
| `LOG_LEVEL`                                          | Optional               | Pino level; defaults to `info`.                                                 |
| `PORT`, `HOSTNAME`                                   | Optional custom server | Defaults to `3000` and `localhost`.                                             |

The source currently uses Supabase for product images. The `AWS_*`,
`NEON_STORAGE_BUCKET`, GitHub OAuth, and non-public `STRIPE_PUBLISHABLE_KEY` entries
present in `.env.example` are not read by the current runtime.

`JOB_SCHEDULAR_*` is intentionally spelled with `SCHEDULAR` because those are the
exact variable names in `lib/job-scheduler.ts`.

### Job-service environment

| Variable                                     | Required | Purpose/default                                                            |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`                               | Yes      | Same PostgreSQL database used by Next.js.                                  |
| `INTERNAL_API_KEY`                           | Yes      | Protects every job endpoint except `/health`.                              |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_SENDER` | Yes      | Email authentication and sender.                                           |
| `REDIS_URL`                                  | No       | Celery broker/result backend; defaults to `redis://localhost:6379/0`.      |
| `SMTP_HOST`                                  | No       | Defaults to `smtp.gmail.com`.                                              |
| `SMTP_PORT`                                  | No       | Defaults to `465`; port 465 uses SSL, other ports use STARTTLS.            |
| `APP_BASE_URL`                               | No       | Absolute base for email links/images; defaults to `http://localhost:3000`. |
| `PAYMENT_CANCEL_DELAY_SECONDS`               | No       | Default endpoint delay; defaults to 300 seconds.                           |
| `AUTO_CANCEL_HOURS`                          | No       | Age threshold for Beat's stale unpaid-order backup; defaults to 120 hours. |
| `AUTO_CANCEL_SCHEDULE_MINUTES`               | No       | Beat interval; defaults to 60 minutes.                                     |

Pydantic loads these settings from `jobs-scheduale/.env` and fails fast when a
required value is absent.

## Frontend

### Page routes and access

| Route                                      | Access                  | Purpose                                                          |
| ------------------------------------------ | ----------------------- | ---------------------------------------------------------------- |
| `/`                                        | Public                  | Redirects to `/products`.                                        |
| `/products`                                | Public                  | Server-seeded catalog with search, filters, sorting, and paging. |
| `/products/[id]`                           | Authenticated currently | Product detail, variants, stock, metadata, and structured data.  |
| `/login`, `/register`                      | Guests                  | Credentials and Google/Facebook authentication.                  |
| `/forgot-password`, `/reset-password`      | Guests                  | One-time password reset flow.                                    |
| `/cart`                                    | Authenticated           | Persistent cart, stock checks, selection, and expiry countdown.  |
| `/checkout`                                | Authenticated           | Shipping, COD/card checkout, saved cards, and payment retry.     |
| `/checkout/success`, `/checkout/failed`    | Authenticated           | Checkout result and recovery screens.                            |
| `/orders`, `/orders/[orderId]`             | Authenticated           | Order history/detail, retry, and reorder.                        |
| `/payment-methods`                         | Authenticated           | Add, remove, and choose a default saved card.                    |
| `/admin`                                   | Admin                   | Redirects to `/admin/products`.                                  |
| `/admin/products`                          | Admin                   | Product/category CRUD-style management and preview.              |
| `/admin/products/bulk`                     | Admin                   | CSV/image review, queue submission, and progress.                |
| `/admin/orders`, `/admin/orders/[orderId]` | Admin                   | Order search, details, and status transitions.                   |

Auth pages are guest-only. Logged-in admins are redirected away from the root,
catalog, and cart to the admin portal. API routes are excluded from the page proxy
and enforce their own session/role checks in controllers or handlers.

### Frontend behavior worth knowing

- The root layout wires Auth.js session synchronization, cart synchronization, and
  global toasts.
- The cart is server-backed. Each line expires 15 minutes after its database
  `createdAt`; quantity changes do not reset the timer.
- Product and order pages combine Server Components for initial data with Client
  Components for interaction.
- Notification sockets are enabled by default only in development. When disabled,
  the notification UI polls every 10 seconds.
- Product image uploads accept image MIME types, create/use a public Supabase bucket,
  and store public URLs in PostgreSQL.
- The bulk-product page accepts the tracked template at
  `public/templates/products-template.csv` and polls background-job progress.

### Bulk product import format

Open **Admin → Products → Add Multiple Products**, then upload a `.csv`, `.xlsx`,
or `.xls` file. The importer converts the first workbook sheet containing product
and price headers when an Excel file has multiple sheets. CSV files may use commas
or semicolons, and header names are matched case-insensitively with spaces,
underscores, and hyphens ignored.

Required columns are `title` (also accepted as `name` or `product`) and `price`.
The recommended columns are:

| Column              | Purpose                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `title`             | Product name. Blank cells inherit the previous title, which supports Excel continuation rows. |
| `price`             | Product price. Blank continuation cells inherit the previous price.                           |
| `category`          | Existing category name, or a category that can be created during review.                      |
| `color`, `size`     | Variant attributes. Missing values may be inferred from the image filename.                   |
| `qty` or `quantity` | Quantity for the row's color/size variant.                                                    |
| `stock`             | Aggregate stock when no variant quantity is supplied.                                         |
| `image` or `images` | One or more image filenames, separated by `                                                   | `or`;`. |

Rows with the same title are merged into one product. Variant quantities remain
bound to their own color/size row and product stock is recalculated from variants.
When `qty` is absent, `stock` is used for a variant row or as product stock. Image
color/size from the sheet takes precedence over filename inference.

After parsing, select the folder containing the referenced images. Exact filenames
listed in the `image` column are preferred; when that column is empty, unique title
or color matches are used. Ambiguous or unrelated files are left unmatched for
manual review. The review screen lets an admin edit products, variants, categories,
and images before submitting.

Submission returns a background job ID when the FastAPI/Celery service is available.
The admin page polls `GET /api/admin/jobs/{jobId}` and displays per-row progress and
results. If the job service is unavailable, the API uses its documented synchronous
fallback; verify the resulting products before relying on the fallback for large
imports.

## Backend API

The primary API is part of the Next.js deployment under `app/api`. `User` means a
valid Auth.js session and `Admin` means a valid session with role `ADMIN`.

### Public and authentication routes

| Method     | Route                       | Access           | Purpose                                                              |
| ---------- | --------------------------- | ---------------- | -------------------------------------------------------------------- |
| `GET`      | `/api/products`             | Public           | Filtered and paginated active products.                              |
| `GET`      | `/api/products/[id]`        | Public API       | Product detail and variants.                                         |
| `GET`      | `/api/categories`           | Public           | Category list.                                                       |
| `GET/POST` | `/api/auth/[...nextauth]`   | Public           | Auth.js provider, callback, and session endpoints.                   |
| `POST`     | `/api/auth/register`        | Public           | Create a credentials user.                                           |
| `POST`     | `/api/auth/forgot-password` | Public           | Create a reset token and queue/fallback-send email.                  |
| `GET/POST` | `/api/auth/reset-password`  | Public           | Validate a reset token or replace the password.                      |
| `POST`     | `/api/auth/login`           | Public           | Legacy route currently wired to registration; UI login uses Auth.js. |
| `POST`     | `/api/checkout/stripe`      | Public, disabled | Compatibility endpoint that always returns 404.                      |

### Customer routes

| Method                  | Route                               | Access | Purpose                                                                         |
| ----------------------- | ----------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `GET/POST/PATCH/DELETE` | `/api/cart`                         | User   | Read, add, update, remove, or clear cart lines.                                 |
| `GET/POST`              | `/api/orders`                       | User   | List orders or create an order. Checkout routes are the canonical payment flow. |
| `GET`                   | `/api/orders/[id]`                  | User   | Read an owned order.                                                            |
| `POST`                  | `/api/orders/[id]/retry`            | User   | Prepare an unpaid order for checkout retry.                                     |
| `POST`                  | `/api/orders/[id]/reorder`          | User   | Rebuild a cart from a cancelled order after stock checks.                       |
| `POST`                  | `/api/checkout/create-intent`       | User   | Create/recreate an order and Stripe PaymentIntent.                              |
| `POST`                  | `/api/checkout/confirm`             | User   | Confirm card payment or finalize/switch to COD.                                 |
| `GET/POST`              | `/api/payment-methods`              | User   | List or attach saved cards.                                                     |
| `DELETE`                | `/api/payment-methods/[id]`         | User   | Detach an owned saved card.                                                     |
| `POST`                  | `/api/payment-methods/default`      | User   | Set the default saved card.                                                     |
| `POST`                  | `/api/payment-methods/setup-intent` | User   | Create a Stripe SetupIntent.                                                    |
| `GET/PATCH`             | `/api/notifications`                | User   | List notifications or mark all read.                                            |
| `PATCH`                 | `/api/notifications/[id]`           | User   | Mark one notification read.                                                     |

### Admin and integration routes

| Method      | Route                      | Access               | Purpose                                                     |
| ----------- | -------------------------- | -------------------- | ----------------------------------------------------------- |
| `GET/POST`  | `/api/admin/categories`    | Admin                | List or create categories.                                  |
| `GET/POST`  | `/api/admin/products`      | Admin                | List or create products.                                    |
| `PUT`       | `/api/admin/products/[id]` | Admin                | Update product data, including active status.               |
| `POST`      | `/api/admin/products/bulk` | Admin                | Validate and queue/fallback-process reviewed bulk products. |
| `POST`      | `/api/admin/upload`        | Admin                | Upload a product image to Supabase.                         |
| `GET`       | `/api/admin/orders`        | Admin                | Filtered/paginated order list.                              |
| `GET/PATCH` | `/api/admin/orders/[id]`   | Admin                | Read an order or change its status.                         |
| `GET`       | `/api/admin/jobs/[jobId]`  | Admin                | Proxy Celery job status from FastAPI.                       |
| `POST`      | `/api/stripe/webhook`      | Stripe signature     | Apply supported PaymentIntent webhook events.               |
| `POST`      | `/api/cron/retry-payments` | Bearer `CRON_SECRET` | Process orders whose automatic retry time is due.           |

Controllers return JSON success/error envelopes and validate most domain input with
Zod. Order creation, inventory consumption/restoration, and important status changes
use database transactions and row locks to limit overselling and duplicate work.

## Background jobs and schedules

The job service accepts trusted requests, returns `202 Accepted` with a Celery job
ID, and stores task state/results in Redis. With the exception of `/health`, requests
must include `X-Internal-Key` matching `INTERNAL_API_KEY`. Celery uses JSON payloads,
UTC, four worker slots, task-state tracking, and a one-hour task limit.

### Job-service endpoints

| Method | Route                                   | Work queued                                                            |
| ------ | --------------------------------------- | ---------------------------------------------------------------------- |
| `GET`  | `/health`                               | Static service response; does not probe Redis, PostgreSQL, or workers. |
| `POST` | `/api/jobs/email/send`                  | Render and send a supported email template.                            |
| `POST` | `/api/jobs/products/bulk`               | Create/update validated products one row at a time.                    |
| `POST` | `/api/jobs/orders/schedule-cancel`      | Delay cancellation of one still-unpaid order.                          |
| `POST` | `/api/jobs/orders/trigger-cancellation` | Run the stale unpaid-order scan immediately.                           |
| `GET`  | `/api/jobs/{job_id}/status`             | Return Celery state, progress, result, or error.                       |

Supported email types are `forgot_password`, `invoice`, `payment_failed`,
`payment_success`, `order_approved`, `order_delivered`, and `order_cancelled`.

### Schedule matrix

| Mechanism                 | Trigger/default                                                 | Responsibility                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Celery email task         | Enqueued by Next.js                                             | Password reset, invoice, payment, and order-status email. Retries SMTP failures up to three times with a 10-second delay.                                     |
| Celery bulk-product task  | Admin bulk submission                                           | Reports per-row progress and commits successful rows individually.                                                                                            |
| Celery delayed order task | First failed card payment; Next.js currently passes 300 seconds | Cancels only if the order is still unpaid, restores stock, creates a notification, and queues cancellation email. Paid/already-cancelled tasks become no-ops. |
| Celery Beat backup        | Every 60 minutes by default                                     | Cancels card orders still `PENDING`/`PROCESSING` and `UNPAID`/`FAILED` after 120 hours by default. Database connection errors retry with exponential backoff. |
| External payment cron     | No schedule is committed                                        | Call `POST /api/cron/retry-payments` with `Authorization: Bearer <CRON_SECRET>` to retry orders whose `nextPaymentRetryAt` is due.                            |
| Next.js cart worker       | Startup, then one second after each completed sweep             | Removes cart lines older than 15 minutes while a long-lived Node runtime is active. Reads and checkout enforce expiry independently.                          |

The payment cron and Celery Beat solve different problems: the cron retries saved
cards when an order is due, while Beat is a safety-net cancellation scan. There is no
`vercel.json` or other external cron schedule in this repository, so deployment must
configure the payment endpoint separately.

Bulk progress is polled by the admin page about every 900 ms for up to five minutes,
although a Celery task may run for up to one hour. A Celery `SUCCESS` can still
contain failed rows, so inspect `failure_count`/`results` when integrating directly.
The product task processes rows independently, so successful rows may be committed
even when other rows fail; retry only the failed rows after reviewing the result.

### Manual job-service processes

For production-style process supervision, run these as separate processes from
`jobs-scheduale/` after activating/installing the virtual environment:

```bash
celery -A app.celery_app.celery_app worker --loglevel=info
celery -A app.celery_app.celery_app beat --loglevel=info
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Run exactly one Beat scheduler per environment to avoid duplicate periodic dispatch.
The more detailed microservice notes are in
[`jobs-scheduale/README.md`](jobs-scheduale/README.md).

## Database

### Models

| Model                     | Responsibility                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| `User`, `Account`         | Credentials/OAuth identity, role, password reset, Stripe customer.      |
| `Category`                | Unique product category name and slug.                                  |
| `Product`, `ProductImage` | Catalog data, soft-active state, primary and alternate images.          |
| `Specification`           | Per-product color/size variant and quantity.                            |
| `CartItem`                | User/product/variant quantity and cart-expiry timestamps.               |
| `Order`, `OrderItem`      | Shipping, payment/order lifecycle, retry state, and purchased variants. |
| `Notification`            | Per-user order notifications and read state.                            |

Order statuses are `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, and
`REJECTED`. Payment statuses are `UNPAID`, `PENDING`, `PROCESSING`, `PAID`,
`SUCCEEDED`, `FAILED`, and `REFUNDED`.

The application calculates 10% tax. Products are normally deactivated instead of
physically deleted so historical order items remain valid. Variant inventory is kept
in `Specification.qty`, with aggregate stock synchronized where background
cancellation restores items.

### Prisma commands

```bash
npm run db:generate       # regenerate @prisma/client
npm run db:migrate        # prisma migrate dev (established development DB)
npm run db:seed           # destructive demo reset and seed
npm run db:studio         # inspect data in Prisma Studio
npx prisma validate       # validate schema/config
```

After the migration history is repaired, production deployments should apply tracked
migrations with `npx prisma migrate deploy`, not `db push` or `migrate dev`.

## Scripts and tests

### Application scripts

| Command                   | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `npm run dev`             | Start the custom Next.js + Socket.IO development server.        |
| `npm run dev:next`        | Start plain Next.js/Turbopack without the custom socket server. |
| `npm run dev:socket`      | Alias of `npm run dev`.                                         |
| `npm run build`           | Generate Prisma Client and create a production Next.js build.   |
| `npm start`               | Run `next start` after a build.                                 |
| `npm run lint`            | Run ESLint.                                                     |
| `npm run lint:fix`        | Run ESLint with automatic fixes.                                |
| `npm run format`          | Format the repository with Prettier.                            |
| `npm run check`           | Check formatting without writes.                                |
| `npm test`                | Run all Jest suites once.                                       |
| `npm run test:watch`      | Run Jest in watch mode.                                         |
| `npm run test:coverage`   | Generate text, LCOV, and HTML coverage reports.                 |
| `npm run images:supabase` | Upload local product images and update matching DB URLs.        |

Husky's pre-commit hook runs the Prettier check and ESLint. The GitHub Actions
workflow runs install, Prisma generation, lint, TypeScript, and the production build;
it does not currently run Jest, Python tests, migrations, or scheduler checks.

Useful stateful diagnostics are available but should only be run against development
services:

```bash
npx tsx scripts/test-smtp.ts
npx tsx scripts/test-full-intent.ts
```

The full-intent script creates an order and Stripe PaymentIntent when suitable seed
data exists.

### Python tests

With `jobs-scheduale/.env` configured and requirements installed:

```bash
cd jobs-scheduale
venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

## Production checklist

- Deploy the Next.js app, PostgreSQL database, FastAPI API, Redis, Celery worker, and
  exactly one Celery Beat instance as separately supervised services.
- Repair and verify the clean Prisma migration chain before applying it to production.
- Use the same database URL/schema for Next.js and the job worker.
- Use strong, distinct Auth.js, internal API, cron, Stripe webhook, SMTP, and provider
  secrets. Never rely on the development fallback in `lib/job-scheduler.ts`.
- Make `JOB_SCHEDULAR_URL` reachable from Next.js without exposing Redis publicly.
- Register Auth.js/OAuth callback URLs for the deployed domain and set `AUTH_URL` or
  `NEXTAUTH_URL` accordingly.
- Configure Stripe's webhook target as `/api/stripe/webhook` and install its signing
  secret.
- Configure an external scheduler for `POST /api/cron/retry-payments`.
- Use persistent process supervision and monitoring for Redis, FastAPI, Worker, and
  Beat; `/health` is a static FastAPI response, not a dependency-readiness check.
- Keep the FastAPI service on a private network where possible and restrict its
  current wildcard CORS policy before exposing it publicly.
- `npm start` runs plain `next start`, not `server.ts`. Production notifications poll
  by default. If Socket.IO is force-enabled, deploy the custom server or another
  compatible socket service and authenticate room membership before treating it as a
  secure channel.
- The in-process cart sweeper requires a continuously running Node process. On
  scale-to-zero/serverless hosting, reads and checkout still reject expired lines,
  but physical cleanup needs a durable worker or external scheduled task.
- Keep the Supabase service-role key server-only and configure the product bucket for
  the intended public-read behavior.

## Known setup caveats

1. **Fresh migration replay:** `prisma/schema.prisma` contains payment fields,
   `PaymentStatus`, and `User.stripeCustomerId` that are not created by the committed
   migrations. A later migration indexes `Order.paymentStatus`, so replaying all
   migrations on an empty database can fail. Use `prisma db push` only for disposable
   local setup, then add/verify a corrective migration before production.
2. **Environment templates:** `.env.example` and `.example-env` contain stale or
   unused entries and omit several variables consumed by the current code. Use the
   environment tables in this README until those templates are reconciled.
3. **Scheduler spelling:** the Next.js client reads `JOB_SCHEDULAR_URL` and
   `JOB_SCHEDULAR_INTERNAL_KEY`, not `JOB_SCHEDULER_*`.
4. **Product detail access:** the current page authorization policy exposes exactly
   `/products` publicly but requires a session for `/products/[id]`, even though the
   detail page produces SEO metadata.
5. **Legacy login route:** `POST /api/auth/login` currently invokes the registration
   controller. The login UI correctly uses Auth.js; integrations should use the
   Auth.js flow rather than this legacy route.
6. **Graceful job fallbacks differ:** bulk import falls back to synchronous Next.js
   processing and password reset falls back to Nodemailer when the scheduler is down.
   The bulk fallback drops categories, variants, and additional images. Other order
   emails and the delayed five-minute cancellation do not have equivalent in-process
   fallbacks.
7. **Retry/cancellation timing conflict:** a first failed card payment records its
   next automatic retry two days later, but normally also schedules cancellation
   after five minutes. A later failure records a three-day retry. Review the intended
   policy before enabling both automatic flows in production.
8. **Socket trust model:** the custom server currently accepts a client-supplied user
   ID when joining notification rooms and allows wildcard Socket.IO CORS. Add
   authenticated socket handshakes before enabling it for sensitive production data.
9. **Legacy order creation:** `POST /api/orders` accepts a client-supplied payment
   status. Use the checkout intent/confirmation endpoints as the canonical paid-order
   path, and harden or retire the legacy endpoint before exposing it to untrusted
   integrations.

For older, file-by-file notes, see [`REPO_DOCUMENTATION.md`](REPO_DOCUMENTATION.md),
but prefer this README and the current source whenever the documents disagree.
