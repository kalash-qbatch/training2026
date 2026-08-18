-- AlterTable CartItem
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "specificationId" TEXT;
ALTER TABLE "CartItem" DROP COLUMN IF EXISTS "color";
ALTER TABLE "CartItem" DROP COLUMN IF EXISTS "size";

-- Drop existing unique index on CartItem
DROP INDEX IF EXISTS "CartItem_userId_productId_color_size_key";

-- Create unique index on CartItem(userId, productId, specificationId)
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_userId_productId_specificationId_key" ON "CartItem"("userId", "productId", "specificationId");

-- AddForeignKey on CartItem -> Specification
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CartItem_specificationId_fkey'
  ) THEN
    ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "specificationId" TEXT;

-- AddForeignKey on OrderItem -> Specification
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_specificationId_fkey'
  ) THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
