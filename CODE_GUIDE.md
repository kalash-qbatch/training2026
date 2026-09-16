# CODE_GUIDE.md — Yeh project kaise chal raha hai?

> **Audience:** Beginners jo har file / line ka idea chaahte hain.  
> **Rule:** Neeche **asli file names + line numbers** is repo se hain. Cursor mein `Cmd/Ctrl+P` se file kholo, phir line number pe jump karo.  
> **Note:** Project ~280 source files (`*.ts` / `*.tsx` / `*.py`). Har ek line ka dump yahan possible nahi — pehle **entry + important flows** detail mein hain; baaki files short map mein. Specific file ke liye Cursor mein bolo:  
> `Now take [FILENAME] specifically and explain every single line...`

---

## 1. PROJECT OVERVIEW

### Yeh project kya hai?

**Bhai ka Store** — full-stack e-commerce:

| Who      | Kya kar sakta hai                                          |
| -------- | ---------------------------------------------------------- |
| Customer | Products dekhna, cart, checkout (Stripe / COD), orders     |
| Admin    | Products/orders manage, CSV bulk upload, SKU update/create |

### Tech stack (simple)

| Layer           | Technology                                  | Folder                                        |
| --------------- | ------------------------------------------- | --------------------------------------------- |
| UI + API        | Next.js 16 App Router, React 19, TypeScript | `app/`, `components/`                         |
| Database        | PostgreSQL + Prisma 7                       | `prisma/`, `lib/db.ts`                        |
| Auth            | NextAuth / Auth.js                          | `auth.ts`, `auth.config.ts`                   |
| Payments        | Stripe                                      | `lib/services/stripe.ts`, `app/api/checkout/` |
| Images          | Supabase Storage                            | `lib/supabase` / upload routes                |
| Background jobs | FastAPI + Celery + Redis                    | `jobs-scheduale/`                             |
| State (browser) | Zustand                                     | `lib/store/`, `lib/bulk-upload-store.ts`      |

### Entry point — app kahan se start hoti hai?

```
npm run dev
   │
   └─ package.json  →  "dev": "tsx server.ts"
         │
         └─ server.ts   ← YEAH pehli file jo chalati hai
```

Production mein aksar `npm start` → `next start` (Socket.IO wala custom server nahi).

---

## 2. FILE STRUCTURE MAP (folders)

```
next_app_fullstack/
├── server.ts              ← Dev server + Socket.IO start
├── proxy.ts               ← Page auth gate (Next 16 “proxy”, purana middleware)
├── auth.ts / auth.config.ts
├── app/
│   ├── layout.tsx         ← Har page ka shell (session, cart sync, toast)
│   ├── page.tsx           ← `/` → redirect `/products`
│   ├── (main)/            ← Customer storefront pages
│   ├── (auth)/            ← Login / register / reset
│   ├── admin/             ← Admin UI pages
│   └── api/               ← Backend HTTP routes (route.ts files)
├── components/            ← React UI
│   ├── admin/             ← Bulk upload, drawers, products table
│   ├── features/          ← Cart, checkout, product cards
│   ├── layout/            ← Navbar, notifications
│   └── ui/                ← Button, Select, Toast…
├── lib/
│   ├── db.ts              ← Prisma client (DB connection)
│   ├── api/               ← Browser se API call helpers
│   ├── controllers/       ← Auth + validate + response
│   ├── services/          ← Business logic + DB queries
│   ├── sku.ts             ← SKU format (pure functions)
│   ├── services/sku.ts    ← SKU + DB allocate
│   ├── bulk-csv.ts        ← CSV/XLSX parse
│   ├── job-scheduler.ts   ← FastAPI jobs ko call
│   ├── store/             ← Zustand auth + cart
│   └── validations/       ← Zod schemas
├── prisma/schema.prisma   ← Tables (Product, Specification, Order…)
├── jobs-scheduale/        ← Email, bulk products, order cancel
└── scripts/               ← backfill-skus, tests, image migrate
```

### Layer rule (yaad rakho)

Har API request almost yeh chain follow karti hai:

```
Browser / Component
    → lib/api/*.ts          (fetch)
    → app/api/**/route.ts   (HTTP door)
    → lib/controllers/*     (admin/user check + validate)
    → lib/services/*        (real business + Prisma)
    → lib/db.ts → PostgreSQL
```

Background kaam:

```
Controller → lib/job-scheduler.ts → jobs-scheduale (FastAPI) → Redis → Celery worker → DB
```

---

## 3. ENTRY FILES — LINE BY LINE (asli code)

### 3.1 `package.json` — scripts

| Script             | Line (approx)                   | Kya karta hai                     |
| ------------------ | ------------------------------- | --------------------------------- |
| `dev`              | `"tsx server.ts"`               | Custom server start               |
| `dev:next`         | `next dev --turbopack`          | Bina Socket.IO plain Next         |
| `build`            | `prisma generate && next build` | Production build                  |
| `db:backfill-skus` | `tsx scripts/backfill-skus.ts`  | Purane products pe SKU lagata hai |
| `test`             | Jest                            | Unit/API tests                    |

**IN:** Terminal command. **OUT:** Process start.

---

### 3.2 `server.ts` — pehli execution

```1:17:server.ts
import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { setSocketServer } from "./lib/socket/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });
```

| Lines | Simple meaning                                                     |
| ----- | ------------------------------------------------------------------ |
| 1–3   | Node HTTP + Next + Socket.IO libraries load                        |
| 5     | `setSocketServer` — baad mein notifications bhejne ke liye IO save |
| 7–9   | Dev mode? Host? Port 3000?                                         |
| 11–12 | Next app banao; har request handle karne wala function lo          |
| 14–17 | Next ready hone ke baad HTTP server: har request Next ko de do     |

```19:55:server.ts
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  setSocketServer(io);

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (userId && typeof userId === "string") {
      socket.join(`user:${userId}`);
    }
    // ... join-user-room / leave-user-room ...
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
```

| Lines | Simple meaning                                   |
| ----- | ------------------------------------------------ |
| 19–26 | Real-time socket path `/api/socket/io`           |
| 29    | Global IO reference — services se emit           |
| 31–36 | User connect → room `user:{id}` join             |
| 51–54 | Port pe listen → browser `http://localhost:3000` |

**Connected to:** `lib/socket/server.ts` (`setSocketServer`).  
**Next:** Browser page request → Next App Router → `app/layout.tsx`.

---

### 3.3 `proxy.ts` — kaun page dekh sakta hai?

```1:5:proxy.ts
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|images).*)"],
};
```

| Line | Meaning                                               |
| ---- | ----------------------------------------------------- |
| 1    | Auth.js ka `auth` function page gate banata hai       |
| 3–4  | API routes skip — unka auth controllers mein hota hai |

**Connected to:** `auth.ts` → `auth.config.ts` → `lib/auth-routing.ts` (`authorizeRequest`).

---

### 3.4 `app/layout.tsx` — har page ka wrapper

Rough flow (file mein):

1. Font + `globals.css` load
2. `auth()` se current user session
3. Wrap children with:
   - `AuthProvider` / `AuthSessionSync` — login state browser mein
   - `CartSync` — cart server se sync
   - `ToastProvider` — success/error messages

**IN:** Har page render. **OUT:** HTML shell + providers.

---

### 3.5 `app/page.tsx`

```ts
// `/` open → turant `/products`
redirect("/products");
```

---

### 3.6 `lib/db.ts` — database door

| Concept               | Meaning                                |
| --------------------- | -------------------------------------- |
| `Pool` (pg)           | PostgreSQL connections                 |
| `PrismaPg` adapter    | Prisma 7 driver                        |
| `export const prisma` | Poori app isi se DB query karti hai    |
| Retry proxy           | Transient network errors pe dubara try |

**Imported by:** Almost har `lib/services/*`, `auth.ts`, scripts.

---

## 4. SKU SYSTEM — files + lines

SKU format:

- Base: `CHAI-001` = titlePrefix + code
- Variant: `CHAI-001-FreeSize-BLK` = + size + color code

### `lib/sku.ts` — pure helpers (DB nahi)

| Function             | Approx lines | Kya karta hai                               |
| -------------------- | ------------ | ------------------------------------------- |
| `extractTitlePrefix` | ~59          | Title se 4-letter prefix (`Chair` → `CHAI`) |
| `formatProductCode`  | ~66          | Number → `001`                              |
| `generateVariantSku` | ~70          | Full variant string                         |
| `parseSku`           | **116–136**  | String todta hai parts mein                 |
| `isValidSkuShape`    | **138–140**  | Valid shape hai ya nahi                     |

```116:136:lib/sku.ts
export function parseSku(sku: string): ParsedSku | null {
  const parts = sku.trim().toUpperCase().split("-").filter(Boolean);
  if (parts.length < 2) return null;

  const titlePrefix = parts[0];
  const code = parts[1];
  if (!/^\d{1,}$/.test(code)) return null;

  if (parts.length === 2) {
    return { titlePrefix, code: formatProductCode(Number(code)), size: "", color: "" };
  }

  const color = parts[parts.length - 1];
  const size = parts.slice(2, -1).join("-");
  return {
    titlePrefix,
    code: formatProductCode(Number(code)),
    size,
    color,
  };
}
```

| Line    | Meaning                                                             |
| ------- | ------------------------------------------------------------------- |
| 117     | `CHAI-001-FreeSize-BLK` → `["CHAI","001","FREESIZE","BLK"]` (upper) |
| 118     | Kam se kam 2 parts chahiye                                          |
| 122     | Code number hona chahiye                                            |
| 124–126 | Sirf base SKU                                                       |
| 128–135 | Last = color, beech = size                                          |

### `lib/services/sku.ts` — DB ke saath

| Function                    | Kya                              |
| --------------------------- | -------------------------------- |
| `allocateProductCode`       | Naya `001`, `002`… lock ke saath |
| `buildVariantSku`           | Color/size resolve + string      |
| `ensureColorAndSizeCatalog` | Color/Size tables seed           |

### `prisma/schema.prisma`

| Model            | Important fields                                                |
| ---------------- | --------------------------------------------------------------- |
| `Product`        | `titlePrefix`, `code`, `stock`, `@@unique([titlePrefix, code])` |
| `Specification`  | `color`, `size`, `qty`, `sku` (unique), productId               |
| `Color` / `Size` | Catalog for codes / names                                       |

---

## 5. DATA FLOW — important actions (File → Line → Next)

### Flow A: App start

```
1. package.json "dev"
2. server.ts:14  app.prepare()
3. server.ts:15–17  HTTP → Next handler
4. proxy.ts:1  auth gate (pages)
5. app/layout.tsx  session + providers
6. app/page.tsx  → /products
7. app/(main)/products/page.tsx
      → lib/services/products.ts  findProducts(...)
      → lib/db.ts prisma
      → components ProductListing UI
```

Text diagram:

```
Terminal → server.ts → Next.js → layout → products page → services/products → Prisma → UI
```

---

### Flow B: Admin CSV bulk upload (sabse important recent feature)

#### Step 1 — CSV parse (browser)

```
components/admin/AddMultipleProductsModal / Bulk flow
  → lib/bulk-csv.ts  parseBulkProductsCsv / parseBulkProductsFile
```

| `bulk-csv.ts` lines | Kya                                       |
| ------------------- | ----------------------------------------- |
| ~161                | Header mein `sku` column dhoondo          |
| ~212                | Row se `rowSku` lo                        |
| ~253–257            | Product ke `skus[]` mein push             |
| ~260–270            | color/size/qty → variant (+ optional sku) |

#### Step 2 — Review page pe SKU classify

```
BulkAddProductsClient.tsx  useEffect (~866–963)
  → validateAdminSkus(allSkus)     // lib/api/admin.ts
  → POST /api/admin/products/validate-skus
```

```6:22:app/api/admin/products/validate-skus/route.ts
export async function POST(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return NextResponse.json(error.body, { status: error.status });
  // ... parse body.skus ...
  const result = await validateSkus(skus);
  return NextResponse.json({ success: true, ...result });
}
```

```
validateSkus (lib/services/products.ts ~605+)
  → findProductBySkuLookup (same file ~569+)
       1) Specification.sku exact (case-insensitive)
       2) else Product.titlePrefix + code
  → UI: isUpdate / existingProductId / matchedSku badges
```

#### Step 3 — Submit

```
BulkAddProductsClient handleSubmit (~1043+)
  → images upload (updates skip images)
  → bulkUploadProductsJson(payload)
  → POST app/api/admin/products/bulk/route.ts:5–7
       → bulkCreateAdminProducts (lib/controllers/admin-products.ts ~232+)
            → enqueueBulkProductsJob (lib/job-scheduler.ts ~72+)
            → POST jobs-scheduale/app/main.py  /api/jobs/products/bulk
            → process_bulk_products_task.delay(...)
            → jobs-scheduale/app/tasks/product_tasks.py
                 → find existing by id / sku / title
                 → _sync_product_variants(..., add_qty=True on update)
                 → commit
```

```5:8:app/api/admin/products/bulk/route.ts
export async function POST(request: Request) {
  try {
    const result = await bulkCreateAdminProducts(request);
    return NextResponse.json(result.body, { status: result.status });
```

**Stock merge rule (update):**  
`product_tasks.py` → `_sync_product_variants` → `add_qty=True` → `current + sheet_qty` (replace nahi).

**Agar Celery band:** controller fallback → `updateProduct(..., addStock: true)` / `createProduct`.

Diagram:

```
CSV → bulk-csv.ts → BulkAddProductsClient
         ↓ validate-skus
    products.ts findProductBySkuLookup
         ↓ submit
    bulk/route → admin-products controller
         ↓
    job-scheduler → FastAPI → Celery worker → PostgreSQL
```

---

### Flow C: Customer cart mein add

```
ProductCard (components/features/...)
  → useCartStore.addItem          lib/store/useCartStore.ts
  → lib/api/cart.ts               POST /api/cart
  → app/api/cart/route.ts
  → lib/controllers/cart.ts       requireUser()
  → lib/services/cart.ts          stock check + CartItem upsert
  → prisma
```

---

### Flow D: Stripe checkout (short)

```
CheckoutForm
  → POST /api/checkout/create-intent
  → create order (lib/services/orders)
  → createPaymentIntent (lib/services/stripe.ts)
  → client Stripe Elements confirm
  → webhook app/api/stripe/webhook  (payment success update)
```

---

### Flow E: Login (credentials)

```
Login UI → Auth.js signIn("credentials")
  → auth.ts providers Credentials authorize (~71–97)
  → prisma.user find + bcrypt.compare
  → jwt callback (~164+) token mein id/role
  → session callback → client session
  → useAuthStore sync
```

---

## 6. CONNECTIONS SUMMARY TABLE

| File                                            | Imports From                               | Imported By / Used By       | Main Purpose                       |
| ----------------------------------------------- | ------------------------------------------ | --------------------------- | ---------------------------------- |
| `server.ts`                                     | `next`, `socket.io`, `lib/socket/server`   | `npm run dev`               | Dev HTTP + sockets                 |
| `proxy.ts`                                      | `@/auth`                                   | Next page requests          | Auth gate                          |
| `auth.ts`                                       | `auth.config`, `lib/db`, bcrypt, providers | `proxy`, layout, API        | Login/session                      |
| `lib/db.ts`                                     | Prisma, `pg`                               | services, auth, scripts     | DB client                          |
| `lib/controllers/http.ts`                       | `auth`                                     | All admin/user controllers  | `requireUser` / `requireAdminUser` |
| `lib/sku.ts`                                    | (none / local)                             | UI, services/sku, tests     | SKU string rules                   |
| `lib/services/sku.ts`                           | `lib/sku`, prisma                          | products service            | Allocate codes                     |
| `lib/services/products.ts`                      | prisma, sku service                        | controllers, validate-skus  | CRUD + SKU lookup                  |
| `lib/bulk-csv.ts`                               | xlsx, product-options                      | Bulk UI / tests             | Parse sheet                        |
| `lib/job-scheduler.ts`                          | `fetch` + env                              | admin-products, emails      | Call FastAPI                       |
| `lib/controllers/admin-products.ts`             | products service, job-scheduler            | `app/api/admin/products/*`  | Admin product HTTP logic           |
| `app/api/admin/products/bulk/route.ts`          | admin-products controller                  | BulkAddProductsClient       | Bulk POST door                     |
| `app/api/admin/products/validate-skus/route.ts` | http + validateSkus                        | BulkAddProductsClient       | SKU match door                     |
| `BulkAddProductsClient.tsx`                     | api/admin, bulk store, sku                 | `/admin/products/bulk` page | Review + submit UI                 |
| `jobs-scheduale/app/main.py`                    | Celery tasks                               | job-scheduler               | Enqueue jobs                       |
| `jobs-scheduale/app/tasks/product_tasks.py`     | models, sku.py                             | Celery worker               | Create/update + merge stock        |
| `lib/store/useCartStore.ts`                     | lib/api/cart                               | Product/cart UI             | Cart state                         |
| `lib/store/useAuthStore.ts`                     | —                                          | Auth sync                   | User session mirror                |
| `lib/bulk-upload-store.ts`                      | zustand                                    | BulkAddProductsClient       | Draft products                     |

---

## 7. KEY VARIABLES & STATE

| Name                           | Where created                | Where updated     | Where used                   |
| ------------------------------ | ---------------------------- | ----------------- | ---------------------------- |
| `prisma`                       | `lib/db.ts`                  | (singleton)       | All DB reads/writes          |
| NextAuth `session` / JWT       | `auth.ts` callbacks          | Login/logout      | layout, `requireUser`, proxy |
| `useAuthStore` user            | AuthSessionSync              | login/logout      | Navbar, guards               |
| `useCartStore` items           | CartSync / addItem           | qty change, clear | Cart UI, checkout            |
| `useBulkUploadStore` products  | CSV parse / setProducts      | edit cards, clear | Bulk review UI               |
| `Product.titlePrefix` + `code` | create / allocate / backfill | title change rare | Base SKU, lookup             |
| `Specification.sku` + `qty`    | create / sync / worker       | orders, bulk add  | Cart, stock, validate        |
| Celery `job_id`                | FastAPI enqueue              | worker progress   | Bulk progress modal poll     |

---

## 8. BAQI FILES — SHORT MAP (skip mat, detail baad mein)

### `app/api/` (har folder = ek HTTP door)

| Area            | Example path                  | Controller / service    |
| --------------- | ----------------------------- | ----------------------- |
| Products public | `app/api/products/`           | products service        |
| Cart            | `app/api/cart/`               | cart controller/service |
| Orders          | `app/api/orders/`             | orders                  |
| Checkout        | `app/api/checkout/`           | orders + stripe         |
| Admin products  | `app/api/admin/products/`     | admin-products          |
| Admin orders    | `app/api/admin/orders/`       | admin orders            |
| Stripe webhook  | `app/api/stripe/webhook/`     | stripe service          |
| Auth            | `app/api/auth/[...nextauth]/` | Auth.js handlers        |

### `components/`

| Folder                            | Role                                     |
| --------------------------------- | ---------------------------------------- |
| `admin/ProductDrawers.tsx`        | Single add/edit product form             |
| `admin/ProductsPageClient.tsx`    | Products table + SKU column              |
| `admin/BulkAddProductsClient.tsx` | Bulk review (long — submit + SKU effect) |
| `features/cart/*`                 | Cart page UI                             |
| `features/checkout/*`             | Checkout form                            |
| `ui/Select.tsx`                   | Dropdown (portal — drawer overflow fix)  |

### `jobs-scheduale/`

| File                         | Role                                      |
| ---------------------------- | ----------------------------------------- |
| `run.sh`                     | `redis` / `api` / `worker` / `beat` start |
| `app/main.py`                | HTTP enqueue endpoints                    |
| `app/sku.py`                 | Python twin of `lib/sku.ts`               |
| `app/tasks/email_tasks.py`   | SMTP emails                               |
| `app/tasks/order_tasks.py`   | Unpaid cancel                             |
| `app/tasks/product_tasks.py` | Bulk products                             |

### Config / quality

| File                    | Role                              |
| ----------------------- | --------------------------------- |
| `next.config.ts`        | Next settings                     |
| `eslint.config.mjs`     | Lint rules                        |
| `jest.config.ts`        | Tests                             |
| `.env` / `.env.example` | Secrets (DB, Stripe, jobs URL)    |
| `__tests__/`            | Jest suites (bulk-csv, sku, API…) |

---

## 9. CURSOR KE LIYE — kaise use karo

1. Is file ko open rakho: `CODE_GUIDE.md`
2. Flow samajhne ke liye example:

```
@CODE_GUIDE.md @lib/services/products.ts
Trace findProductBySkuLookup line by line and show who calls it.
```

3. Ek poori file detail:

```
Now take lib/bulk-csv.ts specifically and explain every important function
with line numbers. Focus on sku column handling.
```

4. Ek feature only:

```
Trace only the flow for "admin bulk product update stock merge"
across BulkAddProductsClient, admin-products controller, and product_tasks.py.
```

5. Connection dhoondho:

```
Find every file and line where validateSkus is used, imported, or called.
```

---

## 10. CHEAT SHEET — “yeh line kahan jaati hai?”

| Main chaho   | Pehli file kholo                                    | Phir jump           |
| ------------ | --------------------------------------------------- | ------------------- |
| Server start | `server.ts:14`                                      | `app/layout.tsx`    |
| Page auth    | `proxy.ts:1`                                        | `auth.config.ts`    |
| DB query     | kisi service mein `prisma.`                         | `lib/db.ts`         |
| SKU parse    | `lib/sku.ts:116`                                    | Bulk UI / validate  |
| SKU DB match | `lib/services/products.ts` `findProductBySkuLookup` | validate-skus route |
| Bulk submit  | `BulkAddProductsClient` handleSubmit                | `bulk/route.ts:5`   |
| Stock add    | `product_tasks.py` `_sync_product_variants`         | Specification.qty   |
| Cart add     | `useCartStore`                                      | `app/api/cart`      |
| Payment      | checkout create-intent                              | stripe + webhook    |

---

**Last tip:** Celery worker Python files **hot-reload nahi** karta. `product_tasks.py` change ke baad `./run.sh worker` restart zaroori hai — warna purana stock-replace logic chal sakta hai.

Agar tum chaho ke agla step mein **sirf ek file** (jaise `BulkAddProductsClient.tsx` ya `product_tasks.py`) ka full line-by-line guide alag se banaye, Cursor chat mein woh filename bata dena.
