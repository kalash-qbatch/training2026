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
    allowExitOnIdle: false,
  });
}

function getPool() {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = createPool();
  }
  return globalForPrisma.pgPool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(getPool());
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 15_000,
      timeout: 30_000,
    },
  });
}

function resetPrismaClientForSchemaBump() {
  if (globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION) return;

  const staleClient = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;

  if (staleClient) {
    // Disconnect only — never end the shared pool here (hot reload + async races
    // leave other module instances using the same pool and cause AccessDenied on login).
    staleClient.$disconnect().catch(() => {});
  }
}

resetPrismaClientForSchemaBump();

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
