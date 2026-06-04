-- Add defaultTemplateName and defaultTemplateLanguage to WhatsAppApiSettings
ALTER TABLE "WhatsAppApiSettings" ADD COLUMN IF NOT EXISTS "defaultTemplateName" TEXT DEFAULT 'hello_world';
ALTER TABLE "WhatsAppApiSettings" ADD COLUMN IF NOT EXISTS "defaultTemplateLanguage" TEXT DEFAULT 'en_US';
