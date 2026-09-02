DROP INDEX IF EXISTS "Order_orderNumber_key";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "orderNumber";

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 4353452;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER;

UPDATE "Order"
SET "orderNumber" = nextval('order_number_seq')
WHERE "orderNumber" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNumber_key" ON "Order"("orderNumber");

SELECT setval(
  'order_number_seq',
  GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "Order"), 4353451), 4353451)
);
