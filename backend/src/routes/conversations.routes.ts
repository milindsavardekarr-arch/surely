/**
 * Conversations Routes — v36
 * GET  /api/conversations          — contact list (last message + unread)
 * GET  /api/conversations/:mobile  — full chat thread
 * POST /api/conversations/:mobile/send — send message
 * PUT  /api/conversations/:mobile/read — mark as read
 */

import { Router } from 'express';
import prisma from '../config/database';
import { authenticate, requireBusinessAccount, AuthRequest } from '../middleware/auth.middleware';
import { sendWhatsAppMessage } from '../services/whatsapp/messageSender';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';
import { logger } from '../utils/logger';
import { Response, NextFunction } from 'express';

const router = Router();
router.use(authenticate, requireBusinessAccount);

// ── GET /conversations ──────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId = req.businessAccountId!;

    const rows = await prisma.$queryRawUnsafe<Array<{
      fromMobile: string;
      fromName:   string;
      contactId:  string | null;
      lastText:   string;
      lastTime:   Date;
      unread:     bigint;
      total:      bigint;
    }>>(`
      SELECT
        im."fromMobile",
        im."fromName",
        im."contactId",
        (SELECT "messageText" FROM "IncomingMessage" i2
         WHERE i2."businessAccountId" = $1 AND i2."fromMobile" = im."fromMobile"
         ORDER BY i2."receivedAt" DESC LIMIT 1) AS "lastText",
        MAX(im."receivedAt") AS "lastTime",
        SUM(CASE WHEN im."isRead" = false THEN 1 ELSE 0 END) AS "unread",
        COUNT(*) AS "total"
      FROM "IncomingMessage" im
      WHERE im."businessAccountId" = $1
      GROUP BY im."fromMobile", im."fromName", im."contactId"
      ORDER BY "lastTime" DESC
    `, baId);

    const contactIds = rows.map(r => r.contactId).filter(Boolean) as string[];
    const contacts   = contactIds.length
      ? await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, leadStage: true } })
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

    const result = rows.map(r => ({
      fromMobile:    r.fromMobile,
      fromName:      r.contactId && contactMap[r.contactId] ? contactMap[r.contactId].name : r.fromName,
      contactId:     r.contactId,
      leadStage:     r.contactId && contactMap[r.contactId] ? contactMap[r.contactId].leadStage : null,
      lastMessage:   r.lastText,
      lastTime:      r.lastTime,
      unreadCount:   Number(r.unread),
      totalMessages: Number(r.total),
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /conversations/:mobile ──────────────────────────────────────────────
router.get('/:mobile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId   = req.businessAccountId!;
    const mobile = normalizeMobile(req.params.mobile) || req.params.mobile;
    const limit  = 50;

    const incoming = await prisma.incomingMessage.findMany({
      where:   { businessAccountId: baId, fromMobile: { contains: mobile.slice(-10) } },
      orderBy: { receivedAt: 'desc' },
      take:    limit,
    });

    const contact = await prisma.contact.findFirst({
      where: { businessAccountId: baId, mobile: { contains: mobile.slice(-10) } },
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
    await prisma.incomingMessage.updateMany({
      where: { businessAccountId: baId, fromMobile: { contains: mobile.slice(-10) }, isRead: false },
      data:  { isRead: true },
    });

    res.json({
      success: true,
      data: {
        contact: contact ? { id: contact.id, name: contact.name, mobile: contact.mobile, leadStage: contact.leadStage } : null,
        mobile,
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
    const mobile = normalizeMobile(req.params.mobile) || req.params.mobile;
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ success: false, error: { message: 'text is required' } });
      return;
    }

    const result = await sendWhatsAppMessage(baId, mobile, text.trim());
    if (!result.sent) {
      res.status(400).json({ success: false, error: { message: result.error || 'Send failed' } });
      return;
    }

    // Save as sent reply in thread
    const contact = await prisma.contact.findFirst({
      where: { businessAccountId: baId, mobile: { contains: mobile.slice(-10) } },
    });
    const status = contact ? await prisma.status.findFirst({
      where:   { businessAccountId: baId, contactId: contact.id },
      orderBy: { timestamp: 'desc' },
    }) : null;

    if (status && contact) {
      await prisma.aiReply.create({
        data: {
          businessAccountId: baId,
          statusId:      status.id,
          contactId:     contact.id,
          generatedText: text.trim(),
          approvalStatus: 'SENT',
          sentAt:        new Date(),
          model:         'manual',
          tokensUsed:    0,
        },
      });
    }

    logger.info(`[Conversations] Sent to ${mobile} via ${result.method}`);
    res.json({ success: true, data: { method: result.method, messageId: result.messageId } });
  } catch (err) { next(err); }
});

// ── PUT /conversations/:mobile/read ─────────────────────────────────────────
router.put('/:mobile/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const baId   = req.businessAccountId!;
    const mobile = req.params.mobile;
    await prisma.incomingMessage.updateMany({
      where: { businessAccountId: baId, fromMobile: { contains: mobile.slice(-10) }, isRead: false },
      data:  { isRead: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
