-- Add onboarding fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardedBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phpUserId"   TEXT;
