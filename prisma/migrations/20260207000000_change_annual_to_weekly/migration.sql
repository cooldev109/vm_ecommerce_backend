-- AlterEnum: Change ANNUAL to WEEKLY in SubscriptionPlan enum
-- First update any existing subscriptions that use ANNUAL
UPDATE "subscriptions" SET "plan_id" = 'MONTHLY' WHERE "plan_id" = 'ANNUAL';
UPDATE "subscription_plan_configs" SET "plan_id" = 'MONTHLY' WHERE "plan_id" = 'ANNUAL';

-- Rename the enum value from ANNUAL to WEEKLY
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'ANNUAL' TO 'WEEKLY';
