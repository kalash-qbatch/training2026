import { prisma } from "@/lib/db";

let ready: Promise<void> | null = null;

/** Ensures order_number_seq + integer orderNumber column exist (safe to call repeatedly). */
export function ensureOrderNumberInfrastructure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 4353452;
      `);

      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'Order'
              AND column_name = 'orderNumber'
              AND data_type <> 'integer'
          ) THEN
            ALTER TABLE "Order" DROP COLUMN "orderNumber";
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'Order'
              AND column_name = 'orderNumber'
          ) THEN
            ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;
          END IF;
        END $$;
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE "Order"
        SET "orderNumber" = nextval('order_number_seq')
        WHERE "orderNumber" IS NULL;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNumber_key" ON "Order"("orderNumber");
      `);

      await prisma.$executeRawUnsafe(`
        SELECT setval(
          'order_number_seq',
          GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "Order"), 4353451), 4353451)
        );
      `);
    })().catch((err) => {
      ready = null;
      console.error("orderNumber infrastructure setup failed:", err);
      throw err;
    });
  }

  return ready;
}
