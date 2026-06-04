-- Add test mode fields to WhatsAppApiSettings
-- isTestMode: when true, Meta sandbox restrictions apply (#131030 fix)
-- allowedTestNumbers: JSON array of numbers whitelisted in Meta test console
ALTER TABLE "WhatsAppApiSettings"
  ADD COLUMN IF NOT EXISTS "isTestMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowedTestNumbers" TEXT;
