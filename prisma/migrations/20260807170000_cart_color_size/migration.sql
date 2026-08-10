-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "size" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX IF EXISTS "CartItem_userId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_color_size_key" ON "CartItem"("userId", "productId", "color", "size");
