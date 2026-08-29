import "dotenv/config";

import dns from "dns";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/** Bump when schema models/relations change so the cached client is recreated. */
const PRISMA_CLIENT_VERSION = 18;

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaVersion?: number;
};

function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET" ||
    e.code === "ECONNREFUSED" ||
    e.code === "EPIPE" ||
    e.code === "P1001" ||
    e.code === "P1017" ||
    e.code === "P2024"
  ) {
    return true;
  }
  return /timeout|connection terminated|can't reach database|connection refused/i.test(
    e.message ?? ""
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    maxLifetimeSeconds: 60,
    allowExitOnIdle: false,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    console.error("[db] pg pool error:", err.message);
  });

  return pool;
}

function getPool() {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = createPool();
  }
  return globalForPrisma.pgPool;
}

async function resetDbConnection() {
  const pool = globalForPrisma.pgPool;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prisma = undefined;

  if (pool) {
    await pool.end().catch(() => {});
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg(getPool());
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 20_000,
      timeout: 45_000,
    },
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

async function runWithRetry<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation(getPrismaClient());
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await resetDbConnection();
      await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

function createRetryProxy(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (value && typeof value === "object" && typeof prop === "string" && !prop.startsWith("$")) {
        return new Proxy(value, {
          get(modelTarget, modelProp) {
            const method = Reflect.get(modelTarget, modelProp);
            if (typeof method !== "function") return method;

            return (...args: unknown[]) =>
              runWithRetry(async (fresh) => {
                const model = (fresh as unknown as Record<string, unknown>)[prop];
                if (!model || typeof model !== "object") {
                  throw new Error(`Prisma model "${prop}" is unavailable`);
                }
                const fn = (model as Record<string, unknown>)[modelProp as string];
                if (typeof fn !== "function") {
                  throw new Error(`Prisma method "${String(modelProp)}" is unavailable`);
                }
                return (fn as (...a: unknown[]) => Promise<unknown>).apply(model, args);
              });
          },
        });
      }

      if (typeof value === "function") {
        return (...args: unknown[]) =>
          runWithRetry(async (fresh) => {
            const fn = (fresh as unknown as Record<string, unknown>)[prop as string];
            if (typeof fn !== "function") {
              throw new Error(`Prisma method "${String(prop)}" is unavailable`);
            }
            return (fn as (...a: unknown[]) => Promise<unknown>).apply(fresh, args);
          });
      }

      return value;
    },
  });
}

function resetPrismaClientForSchemaBump() {
  if (globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION) return;

  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;

  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
}

resetPrismaClientForSchemaBump();

const basePrisma = getPrismaClient();
export const prisma = createRetryProxy(basePrisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.pgPool = getPool();
}
