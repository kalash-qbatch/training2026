-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippingFullName" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingPostalCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "maxPaymentAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Order" ADD COLUMN "nextPaymentRetryAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "lastFailedPaymentIntentId" TEXT;

-- CreateIndex
CREATE INDEX "Order_paymentStatus_nextPaymentRetryAt_idx" ON "Order"("paymentStatus", "nextPaymentRetryAt");
