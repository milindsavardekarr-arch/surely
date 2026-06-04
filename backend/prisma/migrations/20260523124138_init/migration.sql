-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CONNECTING', 'CONNECTED', 'DISCONNECTED', 'QR_PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('LEAD', 'PROSPECT', 'QUALIFIED', 'CUSTOMER', 'CHURNED', 'VIP');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'ACHIEVEMENT', 'FESTIVAL', 'SAD_EMOTION', 'POSITIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EngagementAction" AS ENUM ('STATUS_DETECTED', 'AI_GENERATED', 'REPLY_APPROVED', 'REPLY_EDITED', 'REPLY_REJECTED', 'REPLY_SENT', 'REPLY_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "encryptedSession" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "phoneNumber" TEXT,
    "profileName" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leadStage" "LeadStage" NOT NULL DEFAULT 'LEAD',
    "city" TEXT,
    "notes" TEXT,
    "email" TEXT,
    "birthday" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "contactId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactMobile" TEXT NOT NULL,
    "statusText" TEXT NOT NULL,
    "statusImageUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "detectedEvent" "EventType",
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReply" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "contactId" TEXT,
    "generatedText" TEXT NOT NULL,
    "editedText" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementLog" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "contactId" TEXT,
    "aiReplyId" TEXT,
    "action" "EngagementAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSession_sessionId_key" ON "WhatsappSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_businessAccountId_mobile_key" ON "Contact"("businessAccountId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Status_contactMobile_timestamp_businessAccountId_key" ON "Status"("contactMobile", "timestamp", "businessAccountId");

-- AddForeignKey
ALTER TABLE "BusinessAccount" ADD CONSTRAINT "BusinessAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappSession" ADD CONSTRAINT "WhatsappSession_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReply" ADD CONSTRAINT "AiReply_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReply" ADD CONSTRAINT "AiReply_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReply" ADD CONSTRAINT "AiReply_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_aiReplyId_fkey" FOREIGN KEY ("aiReplyId") REFERENCES "AiReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
