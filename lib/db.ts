import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { Pool } from "pg";

/** Bump when schema models/relations change so the cached client is recreated. */
const PRISMA_CLIENT_VERSION = 7;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion?: number;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (globalForPrisma.prismaVersion !== PRISMA_CLIENT_VERSION) {
  void globalForPrisma.prisma?.$disconnect().catch(() => { });
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Next.js dev mode mein hot-reload ki wajah se agar Prisma Client normal tareeqe se banate to har
//  save pe naya database connection khulta rehta, connections exhaust ho jate.
//   Isliye singleton pattern use kiya taake ek hi client globally reuse ho."
