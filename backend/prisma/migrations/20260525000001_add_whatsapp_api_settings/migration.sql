CREATE TABLE "WhatsAppApiSettings" (
    "id"                   TEXT NOT NULL,
    "businessAccountId"    TEXT NOT NULL,
    "accessTokenEncrypted" TEXT,
    "phoneNumberId"        TEXT,
    "wabaId"               TEXT,
    "verifyToken"          TEXT,
    "webhookCallbackUrl"   TEXT,
    "isEnabled"            BOOLEAN NOT NULL DEFAULT false,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppApiSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppApiSettings_businessAccountId_key" ON "WhatsAppApiSettings"("businessAccountId");
ALTER TABLE "WhatsAppApiSettings" ADD CONSTRAINT "WhatsAppApiSettings_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
