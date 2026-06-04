import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { detectEvent, shouldGenerateReply } from '../services/ai/eventDetection';
import { generateReply } from '../services/ai/replyGenerator';
import { sessionManager } from '../services/automation/whatsappAutomation';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';
import { analyzeImageStatus, buildEnrichedStatusText } from '../services/ai/imageVision';

export const QUEUE_NAMES = {
  STATUS_PROCESSING: 'status-processing',
  AI_REPLY_GENERATION: 'ai-reply-generation',
  WHATSAPP_SEND: 'whatsapp-send',
  STATUS_SCRAPING: 'status-scraping',
} as const;

interface StatusProcessingJob { statusId: string; businessAccountId: string; imageBase64?: string; mimeType?: string; }
interface AiReplyJob { statusId: string; contactId: string | null; businessAccountId: string; eventType: string; statusType?: string; }
interface WhatsappSendJob { replyId: string; sessionId: string; contactMobile: string; message: string; businessAccountId: string; }
interface StatusScrapingJob { sessionId: string; businessAccountId: string; }

const defaultOpts = {
  attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100, removeOnFail: 50,
};

export const statusProcessingQueue = new Queue(QUEUE_NAMES.STATUS_PROCESSING, { connection: redisConnection, defaultJobOptions: defaultOpts });
export const aiReplyQueue = new Queue(QUEUE_NAMES.AI_REPLY_GENERATION, { connection: redisConnection, defaultJobOptions: defaultOpts });
export const whatsappSendQueue = new Queue(QUEUE_NAMES.WHATSAPP_SEND, { connection: redisConnection, defaultJobOptions: defaultOpts });
export const statusScrapingQueue = new Queue(QUEUE_NAMES.STATUS_SCRAPING, { connection: redisConnection, defaultJobOptions: { ...defaultOpts, attempts: 2 } });

// ── Status Processing Worker ──────────────────────────────────────────────────
const createStatusProcessingWorker = () => new Worker(QUEUE_NAMES.STATUS_PROCESSING, async (job: Job<StatusProcessingJob>) => {
  const { statusId, businessAccountId, imageBase64 } = job.data;
  const status = await prisma.status.findUnique({ where: { id: statusId } });
  if (!status || status.processed) return;

  const statusType = (status as Record<string, unknown>).statusType as string | undefined || 'text';
  let textForDetection = status.statusText;
  let visionEventType: string | null = null;  // event detected directly by vision model

  // ── Image Vision: analyze image with AI to understand its meaning ─────────
  // This runs even when caption is empty/missing — that's the whole point for
  // image-only statuses. Vision returns both description AND event type.
  if ((statusType === 'image' || statusType === 'sticker') && imageBase64) {
    try {
      logger.info('[VisionWorker] Analyzing image status ' + statusId + ' (caption: "' + (status.statusText || 'none') + '")');
      const visionResult = await analyzeImageStatus(imageBase64, status.statusText || undefined);
      textForDetection = buildEnrichedStatusText(status.statusText, visionResult);
      visionEventType = visionResult.eventType || null;
      logger.info('[VisionWorker] Vision result → eventType: ' + visionEventType + ' | text: "' + textForDetection.substring(0, 120) + '"');
      // Save enriched description so UI shows what the image contained
      await prisma.status.update({ where: { id: statusId }, data: { statusText: textForDetection } });
    } catch (visionErr) {
      logger.warn('[VisionWorker] Vision failed: ' + (visionErr as Error).message);
    }
  }

  // Keyword-based detection on enriched text
  const detection = detectEvent(textForDetection);

  // Event resolution priority:
  // 1. Keyword detection on vision-enriched text (most specific)
  // 2. Event type returned directly by vision model
  // 3. For image statuses with no caption — default to POSITIVE so we always reply
  let finalEventType = detection.eventType;
  if (!finalEventType && visionEventType && visionEventType !== 'OTHER') {
    finalEventType = visionEventType as never;
    logger.info('[VisionWorker] Using vision model eventType: ' + finalEventType);
  }
  if (!finalEventType && (statusType === 'image' || statusType === 'sticker') && imageBase64) {
    // Image status but no specific event detected — still worth replying with a warm message
    finalEventType = 'POSITIVE' as never;
    logger.info('[VisionWorker] No specific event — defaulting image status to POSITIVE for reply');
  }

  await prisma.status.update({
    where: { id: statusId },
    data: { detectedEvent: finalEventType ?? undefined, keywords: detection.keywords, processed: true },
  });
  await prisma.engagementLog.create({
    data: {
      businessAccountId,
      contactId: status.contactId,
      action: 'STATUS_DETECTED',
      metadata: { eventType: finalEventType, visionUsed: (statusType === 'image' || statusType === 'sticker') && !!imageBase64 },
    },
  });

  if (finalEventType && shouldGenerateReply(finalEventType as never)) {
    await aiReplyQueue.add('generate', {
      statusId,
      contactId: status.contactId,
      businessAccountId,
      eventType: finalEventType,
      statusType,
    });
    logger.info('[VisionWorker] Queued AI reply for ' + statusId + ' → ' + finalEventType);
  }
}, { connection: redisConnection, concurrency: 5 });

// ── AI Reply Worker ───────────────────────────────────────────────────────────
const createAiReplyWorker = () => new Worker(QUEUE_NAMES.AI_REPLY_GENERATION, async (job: Job<AiReplyJob>) => {
  const { statusId, contactId, businessAccountId, eventType, statusType } = job.data;

  // Dedup guard: skip if a non-rejected reply already exists for this status
  const existingReply = await prisma.aiReply.findFirst({
    where: { statusId, businessAccountId, approvalStatus: { notIn: ['REJECTED', 'FAILED'] } },
  });
  if (existingReply) {
    logger.info('[AiReply] Skipping duplicate — reply ' + existingReply.id + ' already exists for status ' + statusId);
    return;
  }

  const [status, contact] = await Promise.all([
    prisma.status.findUnique({ where: { id: statusId } }),
    contactId ? prisma.contact.findUnique({ where: { id: contactId } }) : null,
  ]);
  if (!status) throw new Error('Status ' + statusId + ' not found');

  const previousEngagements = contact
    ? await prisma.engagementLog.count({ where: { contactId, action: 'REPLY_SENT' } })
    : 0;

  const result = await generateReply({
    status,
    contact,
    eventType: eventType as never,
    previousEngagements,
    statusType: (statusType as 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document') || 'text',
  });

  const model = process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile';
  const intentMeta = result.intent ? {
    intent: result.intent.intent,
    targetName: result.intent.targetName,
    relation: result.intent.relation,
    reasoning: result.intent.reasoning,
  } : null;

  const aiReply = await prisma.aiReply.create({
    data: {
      businessAccountId, statusId, contactId,
      generatedText: result.text,
      model, tokensUsed: result.tokensUsed,
      approvalStatus: 'PENDING',
    },
  });
  await prisma.engagementLog.create({
    data: {
      businessAccountId, contactId, aiReplyId: aiReply.id,
      action: 'AI_GENERATED',
      metadata: { tokensUsed: result.tokensUsed, intent: intentMeta },
    },
  });

  // ── Auto-send: check automation rules first, then fall back to BusinessSettings ──
  try {
    // 1. Find a matching active automation rule for this event type
    const matchingRule = await prisma.automationRule.findFirst({
      where: {
        businessAccountId,
        eventType,
        isActive: true,
        autoSend: true,
      },
    });

    // 2. Also check general BusinessSettings auto-send toggle
    const settings = await prisma.businessSettings.findUnique({ where: { businessAccountId } });
    const globalAutoReply = settings?.autoReplyEnabled ?? false;
    const approvalRequired = settings?.approvalRequired ?? true;

    const shouldAutoSend = matchingRule?.autoSend || (globalAutoReply && !approvalRequired);

    if (shouldAutoSend && status) {
      const session = await prisma.whatsappSession.findFirst({ where: { businessAccountId, status: 'CONNECTED' } });
      const mobile = status.contactMobile || contact?.mobile;

      if (session && mobile) {
        // Build message: use rule template (with placeholders) or AI-generated text
        let messageToSend = result.text;
        if (matchingRule) {
          const firstName = (contact?.name || status.contactName || '').split(' ')[0] || 'there';
          messageToSend = matchingRule.template
            .replace(/\{name\}/gi, firstName)
            .replace(/\{fullname\}/gi, contact?.name || status.contactName || firstName);

          // Inject coupon code if present
          if (matchingRule.couponCode) {
            const couponLine = `\n\n🎟 Use code *${matchingRule.couponCode}*` +
              (matchingRule.discountPercent > 0 ? ` for ${matchingRule.discountPercent}% OFF!` : '!');
            messageToSend += couponLine;
          }
        }

        const delayMs = (matchingRule?.delayMinutes ?? settings?.sendDelayMinutes ?? 5) * 60 * 1000;

        setTimeout(async () => {
          try {
            const sent = await sessionManager.sendMessage(session.sessionId, mobile, messageToSend);
            if (sent) {
              await prisma.aiReply.update({
                where: { id: aiReply.id },
                data: { approvalStatus: 'SENT', sentAt: new Date(), generatedText: messageToSend },
              });
              await prisma.engagementLog.create({
                data: { businessAccountId, contactId, aiReplyId: aiReply.id, action: 'REPLY_SENT' },
              });
              logger.info(`[AutoSend] ✅ Sent to ${mobile} for status ${statusId} (rule: ${matchingRule?.name || 'global'})`);
            } else {
              await prisma.aiReply.update({ where: { id: aiReply.id }, data: { approvalStatus: 'FAILED' } });
              logger.warn(`[AutoSend] Send failed to ${mobile}`);
            }
          } catch (e) {
            logger.error('[AutoSend] Failed:', e);
          }
        }, delayMs);

        logger.info(`[AutoSend] Scheduled in ${delayMs / 1000}s → ${mobile} (coupon: ${matchingRule?.couponCode || 'none'})`);
      } else {
        logger.warn(`[AutoSend] No connected session or mobile for ${businessAccountId}`);
      }
    }
  } catch (autoErr) {
    logger.warn('[AutoSend] Check failed:', (autoErr as Error).message);
  }

  logger.info('AI reply created: ' + aiReply.id + ' | intent: ' + (result.intent?.intent || 'none'));
}, { connection: redisConnection, concurrency: 3 });

// ── WhatsApp Send Worker ──────────────────────────────────────────────────────
const createWhatsappSendWorker = () => new Worker(QUEUE_NAMES.WHATSAPP_SEND, async (job: Job<WhatsappSendJob>) => {
  const { replyId, sessionId, contactMobile, message, businessAccountId } = job.data;
  const success = await sessionManager.sendMessage(sessionId, contactMobile, message);
  if (success) {
    await prisma.aiReply.update({ where: { id: replyId }, data: { approvalStatus: 'SENT', sentAt: new Date() } });
    await prisma.engagementLog.create({ data: { businessAccountId, aiReplyId: replyId, action: 'REPLY_SENT' } });
  } else {
    await prisma.aiReply.update({ where: { id: replyId }, data: { approvalStatus: 'FAILED', sendError: 'Send failed' } });
    await prisma.engagementLog.create({ data: { businessAccountId, aiReplyId: replyId, action: 'REPLY_FAILED' } });
    throw new Error('Message send failed');
  }
}, { connection: redisConnection, concurrency: 2 });

// ── Status Scraping Worker ────────────────────────────────────────────────────
const createStatusScrapingWorker = () => new Worker(QUEUE_NAMES.STATUS_SCRAPING, async (job: Job<StatusScrapingJob>) => {
  const { sessionId, businessAccountId } = job.data;
  const statuses = await sessionManager.scrapeStatuses(sessionId);

  for (const statusData of statuses) {
    const contact = await prisma.contact.findFirst({
      where: {
        businessAccountId,
        OR: [
          { mobile: { contains: statusData.contactMobile.slice(-10) } },
          { name: { contains: statusData.contactName, mode: 'insensitive' } },
        ],
      },
    });

    const existing = await prisma.status.findFirst({
      where: {
        businessAccountId,
        contactMobile: normalizeMobile(statusData.contactMobile),
        statusText: statusData.statusText,
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    const status = await prisma.status.create({
      data: {
        businessAccountId,
        contactId: contact?.id ?? null,
        contactName: contact?.name || statusData.contactName,
        contactMobile: normalizeMobile(statusData.contactMobile || contact?.mobile || ''),
        statusText: statusData.statusText,
        statusType: statusData.statusType || 'text',
        timestamp: statusData.timestamp,
      },
    });

    await statusProcessingQueue.add('process', {
      statusId: status.id,
      businessAccountId,
      imageBase64: statusData.imageBase64,
      mimeType: statusData.mimeType,
    });
  }

  logger.info('Scraped ' + statuses.length + ' statuses for ' + sessionId);
}, { connection: redisConnection, concurrency: 1 });

// ── Init all workers ──────────────────────────────────────────────────────────
export const initWorkers = async (): Promise<void> => {
  const workers = [
    { w: createStatusProcessingWorker(), name: 'StatusProcessing' },
    { w: createAiReplyWorker(), name: 'AiReply' },
    { w: createWhatsappSendWorker(), name: 'WhatsappSend' },
    { w: createStatusScrapingWorker(), name: 'StatusScraping' },
  ];
  workers.forEach(({ w, name }) => {
    w.on('completed', (job) => logger.info('[' + name + '] Job ' + job.id + ' completed'));
    w.on('failed', (job, err) => logger.error('[' + name + '] Job ' + job?.id + ' failed: ' + err.message));
  });
  logger.info('✅ ' + workers.length + ' queue workers initialized');
};
