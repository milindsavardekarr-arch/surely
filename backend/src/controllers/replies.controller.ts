import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { aiReplyQueue } from '../queues/workers';
import { sendWhatsAppMessage } from '../services/whatsapp/messageSender';
import { logger } from '../utils/logger';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';

// ── List replies ─────────────────────────────────────────────────────────────
export const listReplies = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page   = parseInt(req.query.page  as string || '1');
    const limit  = parseInt(req.query.limit as string || '20');
    const status = req.query.status as string;

    const where: Record<string, unknown> = { businessAccountId: req.businessAccountId };
    if (status) where.approvalStatus = status;

    const [replies, total] = await Promise.all([
      prisma.aiReply.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          status: true,
          contact: { select: { id: true, name: true, mobile: true, leadStage: true } },
        },
      }),
      prisma.aiReply.count({ where }),
    ]);

    res.json({
      success: true,
      data: replies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

// ── Shared helper: resolve mobile from reply ──────────────────────────────────
function resolveMobile(reply: { contact?: { mobile?: string } | null; status: { contactMobile?: string | null } }): string {
  const contactMobile = normalizeMobile(reply.contact?.mobile || '');
  const statusMobile  = normalizeMobile(reply.status.contactMobile || '');
  return contactMobile || statusMobile;
}

// ── Approve + Send ────────────────────────────────────────────────────────────
export const approveReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { editedText } = z.object({ editedText: z.string().optional() }).parse(req.body);

    const reply = await prisma.aiReply.findFirst({
      where:   { id: req.params.id, businessAccountId: req.businessAccountId },
      include: { status: true, contact: true, businessAccount: true },
    });

    if (!reply) throw new AppError('Reply not found', 404);
    if (reply.approvalStatus === 'SENT')     { res.json({ success: true, message: 'Reply was already sent', alreadySent: true }); return; }
    if (reply.approvalStatus === 'REJECTED') throw new AppError('Reply has been rejected — regenerate to send', 400);

    const finalText = editedText || reply.generatedText;
    const rawMobile = resolveMobile(reply);
    if (!rawMobile) throw new AppError('Contact mobile number not available — add the phone number in CRM Contacts and retry.', 400);

    logger.info(`[Approve] reply=${reply.id} → ${rawMobile}`);

    // Mark approved first
    await prisma.aiReply.update({
      where: { id: reply.id },
      data:  { approvalStatus: 'APPROVED', editedText: editedText || null },
    });
    await prisma.engagementLog.create({
      data: {
        businessAccountId: req.businessAccountId!,
        contactId:  reply.contactId,
        aiReplyId:  reply.id,
        action:     editedText ? 'REPLY_EDITED' : 'REPLY_APPROVED',
      },
    });

    // Send — Baileys first, Meta API fallback (all logic in sendWhatsAppMessage)
    const result = await sendWhatsAppMessage(req.businessAccountId!, rawMobile, finalText);

    if (result.sent) {
      await prisma.aiReply.update({
        where: { id: reply.id },
        data:  { approvalStatus: 'SENT', sentAt: new Date() },
      });
      await prisma.engagementLog.create({
        data: {
          businessAccountId: req.businessAccountId!,
          contactId: reply.contactId,
          aiReplyId: reply.id,
          action:    'REPLY_SENT',
        },
      });
      logger.info(`[Approve] ✅ Sent via ${result.method} → ${rawMobile}`);

      const via = result.method === 'BAILEYS'
        ? '✅ Reply sent via WhatsApp!'
        : result.templateFallback
          ? '✅ Reply sent via template (24h window closed)'
          : '✅ Reply sent via WhatsApp!';

      res.json({ success: true, message: via, data: { method: result.method, templateFallback: result.templateFallback, messageId: result.messageId } });
    } else {
      await prisma.aiReply.update({
        where: { id: reply.id },
        data:  { approvalStatus: 'FAILED', sendError: result.error || 'Send failed' },
      });
      logger.error(`[Approve] ❌ Send failed for reply ${reply.id}: ${result.error}`);
      throw new AppError(result.error || 'WhatsApp send failed. Scan a WhatsApp number in Sessions, or check Meta API settings.', 500);
    }
  } catch (err) { next(err); }
};

// ── Reject reply ─────────────────────────────────────────────────────────────
export const rejectReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reply = await prisma.aiReply.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
    });

    if (!reply) throw new AppError('Reply not found', 404);
    if (['SENT', 'REJECTED'].includes(reply.approvalStatus)) {
      throw new AppError(`Reply already ${reply.approvalStatus.toLowerCase()}`, 400);
    }

    await prisma.aiReply.update({ where: { id: reply.id }, data: { approvalStatus: 'REJECTED' } });
    await prisma.engagementLog.create({
      data: {
        businessAccountId: req.businessAccountId!,
        contactId: reply.contactId,
        aiReplyId: reply.id,
        action:    'REPLY_REJECTED',
      },
    });

    res.json({ success: true, message: 'Reply rejected' });
  } catch (err) { next(err); }
};

// ── Retry a FAILED reply ──────────────────────────────────────────────────────
export const retryReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reply = await prisma.aiReply.findFirst({
      where:   { id: req.params.id, businessAccountId: req.businessAccountId },
      include: { status: true, contact: true, businessAccount: true },
    });

    if (!reply) throw new AppError('Reply not found', 404);
    if (reply.approvalStatus !== 'FAILED') throw new AppError('Only FAILED replies can be retried', 400);

    const finalText = reply.editedText || reply.generatedText;
    const rawMobile = resolveMobile(reply);
    if (!rawMobile) throw new AppError('No valid mobile number — add phone number in CRM Contacts.', 400);

    logger.info(`[Retry] reply=${reply.id} → ${rawMobile}`);

    const result = await sendWhatsAppMessage(req.businessAccountId!, rawMobile, finalText);

    if (result.sent) {
      await prisma.aiReply.update({
        where: { id: reply.id },
        data:  { approvalStatus: 'SENT', sentAt: new Date(), sendError: null },
      });
      await prisma.engagementLog.create({
        data: {
          businessAccountId: req.businessAccountId!,
          contactId: reply.contactId,
          aiReplyId: reply.id,
          action:    'REPLY_SENT',
        },
      });
      logger.info(`[Retry] ✅ Sent via ${result.method}`);
      res.json({ success: true, message: `✅ Retry successful — sent via ${result.method}!`, data: { method: result.method } });
    } else {
      logger.error(`[Retry] ❌ Retry failed: ${result.error}`);
      throw new AppError(result.error || 'Retry failed. Scan a WhatsApp number in Sessions or check Meta API settings.', 500);
    }
  } catch (err) { next(err); }
};

// ── Regenerate reply ──────────────────────────────────────────────────────────
export const regenerateReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reply = await prisma.aiReply.findFirst({
      where:   { id: req.params.id, businessAccountId: req.businessAccountId },
      include: { status: true },
    });

    if (!reply) throw new AppError('Reply not found', 404);

    await prisma.aiReply.update({ where: { id: reply.id }, data: { approvalStatus: 'REJECTED' } });

    try {
      await aiReplyQueue.add('generate', {
        statusId:          reply.statusId,
        contactId:         reply.contactId,
        businessAccountId: req.businessAccountId,
        eventType:         reply.status.detectedEvent || 'OTHER',
      });
      res.json({ success: true, message: 'Reply regeneration queued' });
    } catch {
      // Redis unavailable — regenerate inline
      const { generateReply } = await import('../services/ai/replyGenerator');
      const { detectEvent }   = await import('../services/ai/eventDetection');
      const contact   = await prisma.contact.findUnique({ where: { id: reply.contactId || '' } }).catch(() => null);
      const eventType = reply.status.detectedEvent || detectEvent(reply.status.statusText).eventType || 'OTHER';
      const result    = await generateReply({ status: reply.status, contact, eventType: eventType as never });

      await prisma.aiReply.create({
        data: {
          businessAccountId: req.businessAccountId!,
          statusId:          reply.statusId,
          contactId:         reply.contactId,
          generatedText:     result.text,
          model:             process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
          tokensUsed:        result.tokensUsed,
          approvalStatus:    'PENDING',
        },
      });
      res.json({ success: true, message: 'Reply regenerated' });
    }
  } catch (err) { next(err); }
};
