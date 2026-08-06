-- AlterTable
ALTER TABLE "Specification" ADD COLUMN "qty" INTEGER NOT NULL DEFAULT 0;

-- Migrate qty from key where key was numeric
UPDATE "Specification" SET "qty" = CASE
  WHEN "key" ~ '^[0-9]+$' THEN "key"::INTEGER
  ELSE 0
END;

-- Backfill null color/size before NOT NULL
UPDATE "Specification" SET "color" = 'Black' WHERE "color" IS NULL;
UPDATE "Specification" SET "size" = 'Medium' WHERE "size" IS NULL;

-- AlterTable
ALTER TABLE "Specification" ALTER COLUMN "color" SET NOT NULL;
ALTER TABLE "Specification" ALTER COLUMN "size" SET NOT NULL;

-- DropColumn
ALTER TABLE "Specification" DROP COLUMN "key";

-- CreateIndex
CREATE UNIQUE INDEX "Specification_productId_color_size_key" ON "Specification"("productId", "color", "size");
