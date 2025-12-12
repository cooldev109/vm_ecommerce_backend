/*
  Warnings:

  - You are about to drop the column `redeemed_by` on the `audio_access_keys` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audio_access_keys" DROP COLUMN "redeemed_by",
ADD COLUMN     "redeemed_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "audio_access_keys" ADD CONSTRAINT "audio_access_keys_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
