-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "sendDelayMinutes" INTEGER NOT NULL DEFAULT 5,
    "workingHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "workingHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "workingHoursEnd" TEXT NOT NULL DEFAULT '21:00',
    "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 50,
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spamProtection" BOOLEAN NOT NULL DEFAULT true,
    "consentRequired" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnDetection" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_businessAccountId_key" ON "BusinessSettings"("businessAccountId");

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
