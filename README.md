This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Cart expiration

Cart lines expire 15 minutes after their database `createdAt` timestamp. Quantity
changes do not extend this deadline. The TTL is defined in `lib/cart-expiration.ts`;
no schema migration is required. Cart responses include `expiresAt` so open pages
can refresh from the backend when a line expires.

The Node server starts a cleanup worker through `instrumentation.ts`. It sweeps on
startup and once per second after each completed sweep, including when browsers
are closed. Reads and checkout also enforce the deadline, independently of cleanup.
Checkout claims live cart lines inside its order transaction; existing orders and
their payment retries are unaffected by cart expiration.

Run a continuously running Node server (`npm run dev` or `npm start`) for background
cleanup. Restart the server after introducing the instrumentation file. A suspended
or serverless process cannot run the worker while idle; such deployments need an
external scheduled worker calling `expireCartItems`. Expired lines remain unusable
on reads and checkout even while background cleanup is stopped.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# training2026
