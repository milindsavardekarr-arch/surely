-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "delayMinutes" INTEGER NOT NULL DEFAULT 5,
    "couponCode" TEXT,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
