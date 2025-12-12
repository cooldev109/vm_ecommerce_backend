/*
  Warnings:

  - You are about to drop the column `address` on the `addresses` table. All the data in the column will be lost.
  - Added the required column `region` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `addresses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "addresses" DROP COLUMN "address",
ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "street" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "tracking_number" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "audio_duration" INTEGER,
ADD COLUMN     "audio_title" TEXT,
ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "stock_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "preferred_language" "Language" NOT NULL DEFAULT 'ES',
ALTER COLUMN "phone" DROP NOT NULL;
