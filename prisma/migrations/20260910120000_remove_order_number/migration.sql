-- DropIndex
DROP INDEX IF EXISTS "Order_orderNumber_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN IF EXISTS "orderNumber";

-- DropSequence
DROP SEQUENCE IF EXISTS order_number_seq;
