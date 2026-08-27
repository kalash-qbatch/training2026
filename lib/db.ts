import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/** Bump when schema models/relations change so the cached client is recreated. */
const PRISMA_CLIENT_VERSION = 12;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaVersion?: number;
};

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL!,
    // Neon pooler is connection-limited; keep this low and reuse one pool.
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
}

function createPrismaClient() {
  const pool = globalForPrisma.pgPool ?? createPool();
  globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 15_000,
      timeout: 30_000,
    },
  });
}

async function disposeClient() {
  try {
    await globalForPrisma.prisma?.$disconnect();
  } catch {
    // ignore
  }
  try {
    await globalForPrisma.pgPool?.end();
  } catch {
    // ignore
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
}

if (globalForPrisma.prismaVersion !== PRISMA_CLIENT_VERSION) {
  void disposeClient();
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
