-- Migration: Reduce AudioCategory enum to only AMBIENT and MEDITATION
-- This migration updates existing FREQUENCY and EXCLUSIVE records to MEDITATION
-- before removing those enum values

-- Update existing audio content records
-- Change FREQUENCY to MEDITATION
UPDATE "audio_contents"
SET category = 'MEDITATION'
WHERE category = 'FREQUENCY';

-- Change EXCLUSIVE to MEDITATION
UPDATE "audio_contents"
SET category = 'MEDITATION'
WHERE category = 'EXCLUSIVE';

-- Update the enum type
-- First, create a new enum with only the desired values
CREATE TYPE "AudioCategory_new" AS ENUM ('AMBIENT', 'MEDITATION');

-- Update the column to use the new enum
ALTER TABLE "audio_contents"
  ALTER COLUMN "category" TYPE "AudioCategory_new"
  USING category::text::"AudioCategory_new";

-- Drop the old enum and rename the new one
DROP TYPE "AudioCategory";
ALTER TYPE "AudioCategory_new" RENAME TO "AudioCategory";
