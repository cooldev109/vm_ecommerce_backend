-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "payment_status" TEXT,
ADD COLUMN     "webpay_token" TEXT,
ADD COLUMN     "webpay_transaction_id" TEXT,
ALTER COLUMN "started_at" DROP NOT NULL,
ALTER COLUMN "expires_at" DROP NOT NULL,
ALTER COLUMN "next_renewal" DROP NOT NULL;
