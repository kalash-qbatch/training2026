-- Phase 1: nullable SKU columns + Color/Size tables (safe on existing data)

CREATE TABLE IF NOT EXISTS "Color" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Color_name_key" ON "Color"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Color_code_key" ON "Color"("code");

CREATE TABLE IF NOT EXISTS "Size" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Size_name_key" ON "Size"("name");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "titlePrefix" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE INDEX IF NOT EXISTS "Product_titlePrefix_idx" ON "Product"("titlePrefix");

ALTER TABLE "Specification" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Specification_sku_key" ON "Specification"("sku");
CREATE INDEX IF NOT EXISTS "Specification_sku_idx" ON "Specification"("sku");

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;

-- Unique (titlePrefix, code) allows multiple NULLs in Postgres
CREATE UNIQUE INDEX IF NOT EXISTS "Product_titlePrefix_code_key" ON "Product"("titlePrefix", "code");
