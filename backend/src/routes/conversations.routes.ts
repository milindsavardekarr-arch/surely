/**
 * Conversations Routes — v36
 * Normalized mobile matching to prevent duplicate contacts
 */

import { Router } from 'express';
import prisma from '../config/database';
import { authenticate, requireBusinessAccount, AuthRequest } from '../middleware/auth.middleware';
import { sendWhatsAppMessage } from '../services/whatsapp/messageSender';
import { logger } from '../utils/logger';
import { Response, NextFunction } from 'express';

const router = Router();
router.use(authenticate, requireBusinessAccount);

// Normalize mobile to last 10 digits
function normMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.slice(-10);
}

// ── GET /conversations ──────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId = req.businessAccountId!;

    // Get all messages, normalize to last 10 digits for grouping
    const rows = await prisma.$queryRawUnsafe<Array<{
      normMobile: string;
      fromName:   string;
      contactId:  string | null;
      lastText:   string;
      lastTime:   Date;
      unread:     bigint;
      total:      bigint;
    }>>(`
      SELECT
        RIGHT(REGEXP_REPLACE(im."fromMobile", '[^0-9]', '', 'g'), 10) AS "normMobile",
        (ARRAY_AGG(im."fromName" ORDER BY im."receivedAt" DESC))[1] AS "fromName",
        (ARRAY_AGG(im."contactId") FILTER (WHERE im."contactId" IS NOT NULL))[1] AS "contactId",
        (ARRAY_AGG(im."messageText" ORDER BY im."receivedAt" DESC))[1] AS "lastText",
        MAX(im."receivedAt") AS "lastTime",
        SUM(CASE WHEN im."isRead" = false THEN 1 ELSE 0 END) AS "unread",
        COUNT(*) AS "total"
      FROM "IncomingMessage" im
      WHERE im."businessAccountId" = $1
      GROUP BY RIGHT(REGEXP_REPLACE(im."fromMobile", '[^0-9]', '', 'g'), 10)
      ORDER BY "lastTime" DESC
    `, baId);

    const contactIds = rows.map(r => r.contactId).filter(Boolean) as string[];
    const contacts   = contactIds.length
      ? await prisma.contact.findMany({
          where:  { id: { in: contactIds } },
          select: { id: true, name: true, leadStage: true, mobile: true },
        })
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

    // Also try to match contacts by mobile if no contactId
    const allContacts = await prisma.contact.findMany({
      where:  { businessAccountId: baId },
      select: { id: true, name: true, leadStage: true, mobile: true },
    });

    const result = rows.map(r => {
      const linked = r.contactId ? contactMap[r.contactId] : null;
      const byMobile = !linked ? allContacts.find(c => normMobile(c.mobile || '') === r.normMobile) : null;
      const contact  = linked || byMobile;

      return {
        fromMobile:    r.normMobile,
        fromName:      contact ? contact.name : r.fromName,
        contactId:     contact ? contact.id : r.contactId,
        leadStage:     contact ? contact.leadStage : null,
        lastMessage:   r.lastText,
        lastTime:      r.lastTime,
        unreadCount:   Number(r.unread),
        totalMessages: Number(r.total),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /conversations/:mobile ──────────────────────────────────────────────
router.get('/:mobile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId      = req.businessAccountId!;
    const rawMobile = req.params.mobile;
    const norm      = normMobile(rawMobile);
    const limit     = 50;

    // Match by last 10 digits
    const incoming = await prisma.$queryRawUnsafe<Array<{
      id: string; messageText: string; messageType: string;
      isRead: boolean; source: string; receivedAt: Date;
    }>>(`
      SELECT id, "messageText", "messageType", "isRead", source, "receivedAt"
      FROM "IncomingMessage"
      WHERE "businessAccountId" = $1
        AND RIGHT(REGEXP_REPLACE("fromMobile", '[^0-9]', '', 'g'), 10) = $2
      ORDER BY "receivedAt" DESC
      LIMIT $3
    `, baId, norm, limit);

    const contact = await prisma.contact.findFirst({
      where: {
        businessAccountId: baId,
        mobile: { contains: norm },
      },
    });

    const sent = contact ? await prisma.aiReply.findMany({
      where:   { businessAccountId: baId, contactId: contact.id, approvalStatus: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take:    limit,
      select:  { id: true, generatedText: true, editedText: true, sentAt: true, createdAt: true },
    }) : [];

    const thread = [
      ...incoming.map(m => ({
        id:      m.id,
        type:    'incoming' as const,
        text:    m.messageText,
        msgType: m.messageType,
        time:    m.receivedAt,
        isRead:  m.isRead,
        source:  m.source,
      })),
      ...sent.map(r => ({
        id:      r.id,
        type:    'sent' as const,
        text:    r.editedText || r.generatedText,
        msgType: 'text',
        time:    r.sentAt || r.createdAt,
        isRead:  true,
        source:  'ai',
      })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Mark as read
    await prisma.$executeRawUnsafe(`
      UPDATE "IncomingMessage"
      SET "isRead" = true
      WHERE "businessAccountId" = $1
        AND RIGHT(REGEXP_REPLACE("fromMobile", '[^0-9]', '', 'g'), 10) = $2
        AND "isRead" = false
    `, baId, norm);

    res.json({
      success: true,
      data: {
        contact: contact ? { id: contact.id, name: contact.name, mobile: contact.mobile, leadStage: contact.leadStage } : null,
        mobile:  norm,
        thread,
        hasMore: incoming.length === limit,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /conversations/:mobile/send ────────────────────────────────────────
router.post('/:mobile/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId   = req.businessAccountId!;
    const norm   = normMobile(req.params.mobile);
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ success: false, error: { message: 'text is required' } });
      return;
    }

    const result = await sendWhatsAppMessage(baId, norm, text.trim());
    if (!result.sent) {
      res.status(400).json({ success: false, error: { message: result.error || 'Send failed' } });
      return;
    }

    const contact = await prisma.contact.findFirst({
      where: { businessAccountId: baId, mobile: { contains: norm } },
    });
    const status = contact ? await prisma.status.findFirst({
      where:   { businessAccountId: baId, contactId: contact.id },
      orderBy: { timestamp: 'desc' },
    }) : null;

    if (status && contact) {
      await prisma.aiReply.create({
        data: {
          businessAccountId: baId,
          statusId:       status.id,
          contactId:      contact.id,
          generatedText:  text.trim(),
          approvalStatus: 'SENT',
          sentAt:         new Date(),
          model:          'manual',
          tokensUsed:     0,
        },
      });
    }

    logger.info(`[Conversations] Sent to ${norm} via ${result.method}`);
    res.json({ success: true, data: { method: result.method, messageId: result.messageId } });
  } catch (err) { next(err); }
});

// ── PUT /conversations/:mobile/read ─────────────────────────────────────────
router.put('/:mobile/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId = req.businessAccountId!;
    const norm = normMobile(req.params.mobile);
    await prisma.$executeRawUnsafe(`
      UPDATE "IncomingMessage"
      SET "isRead" = true
      WHERE "businessAccountId" = $1
        AND RIGHT(REGEXP_REPLACE("fromMobile", '[^0-9]', '', 'g'), 10) = $2
        AND "isRead" = false
    `, baId, norm);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;