import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import prisma from '../config/database';
import { authenticate, requireBusinessAccount, AuthRequest } from '../middleware/auth.middleware';
import { generateReply } from '../services/ai/replyGenerator';
import { detectEvent } from '../services/ai/eventDetection';
import { sendWhatsAppMessage } from '../services/whatsapp/messageSender';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';
import { logger } from '../utils/logger';
import { shouldGenerateReply } from '../services/ai/eventDetection';
import { aiReplyQueue } from '../queues/workers';
import { analyzeImageStatus, buildEnrichedStatusText } from '../services/ai/imageVision';
import { sessionManager } from '../services/automation/whatsappAutomation';

const router = Router();
router.use(authenticate, requireBusinessAccount);

// ── GET /statuses — paginated list ─────────────────────────────────────────
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const eventType = req.query.eventType as string;

    const where: Record<string, unknown> = { businessAccountId: req.businessAccountId };
    if (eventType) where.detectedEvent = eventType;

    const [statuses, total] = await Promise.all([
      prisma.status.findMany({
        where, orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: {
          contact: { select: { id: true, name: true, mobile: true, leadStage: true, notes: true, tags: true } },
          aiReplies: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, approvalStatus: true, generatedText: true, editedText: true, sentAt: true },
          },
        },
      }),
      prisma.status.count({ where }),
    ]);

    res.json({
      success: true,
      data: statuses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ── POST /statuses/:id/generate-reply — Generate AI reply (preview) ────────
router.post('/:id/generate-reply', async (req: AuthRequest, res, next) => {
  try {
    const status = await prisma.status.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
      include: {
        contact: true,
      },
    });
    if (!status) { res.status(404).json({ success: false, error: { message: 'Status not found' } }); return; }

    const statusType = (status as Record<string, unknown>).statusType as string || 'text';
    let statusText = status.statusText;

    // ── If image status and text looks unenriched, run vision now ─────────
    const isImageUnenriched = (statusType === 'image' || statusType === 'sticker') &&
      (!statusText || statusText === '[Image Status]' || statusText === '[Sticker Status]' || statusText.length < 10);

    if (isImageUnenriched) {
      try {
        const mobile = status.contactMobile;
        const digits = mobile?.replace(/\D/g, '');
        let imageBase64: string | undefined;

        if (digits) {
          const dbSession = await prisma.whatsappSession.findFirst({
            where: { businessAccountId: req.businessAccountId!, status: 'CONNECTED' },
          });
          if (dbSession) {
            const liveData = sessionManager.getStatusData(dbSession.sessionId, digits);
            imageBase64 = liveData?.imageBase64;
          }
        }

        if (imageBase64) {
          logger.info(`[GenerateReply] Running vision for image status ${status.id}`);
          const visionResult = await analyzeImageStatus(imageBase64, status.statusText || undefined);
          statusText = buildEnrichedStatusText(status.statusText, visionResult);
          await prisma.status.update({ where: { id: status.id }, data: { statusText } });
          logger.info(`[GenerateReply] Vision enriched: "${statusText.substring(0, 100)}"`);
        }
      } catch (visionErr) {
        logger.warn('[GenerateReply] Vision failed:', (visionErr as Error).message);
      }
    }

    const statusForReply = { ...status, statusText };
    const eventType = status.detectedEvent || detectEvent(statusText).eventType || 'OTHER';

    const previousEngagements = status.contactId
      ? await prisma.engagementLog.count({ where: { contactId: status.contactId, action: 'REPLY_SENT' } })
      : 0;

    const result = await generateReply({
      status: statusForReply,
      contact: status.contact,
      eventType: eventType as never,
      previousEngagements,
      statusType: statusType as 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document',
    });

    res.json({ success: true, data: { replyText: result.text, tokensUsed: result.tokensUsed, eventType, intent: result.intent } });
  } catch (err) {
    logger.error('Generate reply error:', err);
    next(err);
  }
});

// ── POST /statuses/:id/quick-send — Generate + Send in one click ───────────
router.post('/:id/quick-send', async (req: AuthRequest, res, next) => {
  try {
    const { replyText } = req.body; // optional: use provided text instead of generating

    const status = await prisma.status.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
      include: { contact: true },
    });
    if (!status) { res.status(404).json({ success: false, error: { message: 'Status not found' } }); return; }

    // Prefer CRM contact.mobile (reliable) over stored contactMobile (may contain Baileys JID numbers)
    const rawMobile = status.contact?.mobile || status.contactMobile;
    if (!rawMobile) { res.status(400).json({ success: false, error: { message: 'No mobile number for this contact' } }); return; }
    const mobile = normalizeMobile(rawMobile);
    logger.info(`[Status Send] Resolved mobile: "${rawMobile}" → "${mobile}" (contact.mobile=${status.contact?.mobile}, contactMobile=${status.contactMobile})`);

    // Use provided text or generate fresh
    let finalText = replyText;
    let tokensUsed = 0;
    if (!finalText) {
      const eventType = status.detectedEvent || detectEvent(status.statusText).eventType || 'OTHER';
      const previousEngagements = status.contactId
        ? await prisma.engagementLog.count({ where: { contactId: status.contactId, action: 'REPLY_SENT' } })
        : 0;
      const result = await generateReply({
        status, contact: status.contact, eventType: eventType as never, previousEngagements,
      });
      finalText = result.text;
      tokensUsed = result.tokensUsed;
    }

    // ── Send via Meta WhatsApp Cloud API ─────────────────────────────────
    const sendResult = await sendWhatsAppMessage(req.businessAccountId!, mobile, finalText);
    const sent = sendResult.sent;
    if (!sent) {
      res.status(400).json({ success: false, error: { message: sendResult.error || 'Send failed via Meta API' } });
      return;
    }

    // Upsert reply record — update existing PENDING/APPROVED/FAILED, or create new
    const existingReply = await prisma.aiReply.findFirst({
      where: { statusId: status.id, businessAccountId: req.businessAccountId! },
      orderBy: { createdAt: 'desc' },
    });

    let reply;
    if (existingReply && existingReply.approvalStatus !== 'SENT') {
      reply = await prisma.aiReply.update({
        where: { id: existingReply.id },
        data: {
          generatedText: finalText,
          editedText: replyText ? finalText : null,
          approvalStatus: sent ? 'SENT' : 'FAILED',
          sentAt: sent ? new Date() : undefined,
          tokensUsed: tokensUsed || existingReply.tokensUsed,
        },
      });
    } else if (!existingReply || existingReply.approvalStatus === 'SENT') {
      reply = await prisma.aiReply.create({
        data: {
          businessAccountId: req.businessAccountId!,
          statusId: status.id,
          contactId: status.contactId,
          generatedText: finalText,
          editedText: replyText ? finalText : null,
          approvalStatus: sent ? 'SENT' : 'FAILED',
          sentAt: sent ? new Date() : undefined,
          tokensUsed,
          model: process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
        },
      });
    } else {
      reply = existingReply;
    }

    if (sent) {
      await prisma.engagementLog.create({
        data: {
          businessAccountId: req.businessAccountId!,
          contactId: status.contactId,
          aiReplyId: reply.id,
          action: 'REPLY_SENT',
        },
      });
    }

    logger.info(`Quick-send SUCCESS via Meta API for status ${status.id} → ${mobile} | msgId: ${sendResult.messageId}`);
    res.json({ success: sent, data: { replyText: finalText, sent, replyId: reply.id } });
  } catch (err) {
    logger.error('Quick-send error:', err);
    next(err);
  }
});


// ── POST /statuses/manual — Add status manually ───────────────────────────
router.post('/manual', async (req: AuthRequest, res, next) => {
  try {
    const { contactName, contactMobile, statusText } = req.body;
    if (!contactName || !statusText) {
      res.status(400).json({ success: false, error: { message: 'contactName and statusText required' } });
      return;
    }

    // Find matching contact
    const contact = await prisma.contact.findFirst({
      where: {
        businessAccountId: req.businessAccountId,
        OR: [
          contactMobile ? { mobile: { contains: contactMobile.slice(-10) } } : {},
          { name: { contains: contactName, mode: 'insensitive' as const } },
        ].filter(o => Object.keys(o).length > 0),
      },
    });

    // Detect event
    const detection = detectEvent(statusText);

    const status = await prisma.status.create({
      data: {
        businessAccountId: req.businessAccountId!,
        contactId: contact?.id ?? null,
        contactName: contact?.name || contactName,
        contactMobile: contactMobile || contact?.mobile || '',
        statusText: statusText.trim(),
        timestamp: new Date(),
        detectedEvent: detection.eventType ?? undefined,
        keywords: detection.keywords,
        processed: true,
      },
    });

    await prisma.engagementLog.create({
      data: {
        businessAccountId: req.businessAccountId!,
        contactId: contact?.id ?? null,
        action: 'STATUS_DETECTED',
        metadata: { eventType: detection.eventType, manual: true },
      },
    });

    // Note: AI reply generation is triggered manually by the user from the Status Monitor UI
    // Auto-queueing here would create duplicate replies when the user clicks Generate

    res.status(201).json({
      success: true,
      data: { ...status, detectedEvent: detection.eventType },
      message: detection.eventType
        ? `Status added! Detected: ${detection.eventType}`
        : 'Status added',
    });
  } catch (err) { next(err); }
});

export default router;
