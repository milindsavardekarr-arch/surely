-- Prisma migration: add plan fields to User table
-- Run via: npx prisma db execute --file prisma/migrations/add_plan_expiry.sql
-- OR just run: npx prisma migrate dev --name add_plan_expiry  (after updating schema.prisma)

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "plan"          VARCHAR(20) NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP;
