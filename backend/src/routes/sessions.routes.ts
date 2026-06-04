import { Router } from 'express';
import {
  listSessions, getSessionStatus, disconnectSession, triggerStatusScrape,
} from '../controllers/sessions.controller';
import { authenticate, requireBusinessAccount, AuthRequest } from '../middleware/auth.middleware';
import { sessionManager, StatusData } from '../services/automation/whatsappAutomation';
import prisma from '../config/database';
import { detectEvent, shouldGenerateReply } from '../services/ai/eventDetection';
import { aiReplyQueue } from '../queues/workers';
import { logger } from '../utils/logger';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';

const router = Router();
router.use(authenticate, requireBusinessAccount);

router.get('/', listSessions);
router.post('/scrape', triggerStatusScrape);
router.get('/:id', getSessionStatus);
router.delete('/:id', disconnectSession);

// ── DIRECT scrape — bypasses Redis queue, works without Redis ─────────────
// This is the reliable fallback used by the "Scan Statuses" button
router.post('/scrape-direct', async (req: AuthRequest, res, next) => {
  try {
    const sessions = await prisma.whatsappSession.findMany({
      where: { businessAccountId: req.businessAccountId, status: 'CONNECTED' },
    });

    if (sessions.length === 0) {
      res.status(400).json({ success: false, error: { message: 'No connected WhatsApp sessions' } });
      return;
    }

    let totalNew = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      try {
        logger.info(`Direct scraping session ${session.sessionId}`);
        const statuses = await sessionManager.scrapeStatuses(session.sessionId);
        logger.info(`Got ${statuses.length} statuses from session ${session.sessionId}`);

        for (const statusData of statuses) {
          // Match contact
          const contact = await prisma.contact.findFirst({
            where: {
              businessAccountId: req.businessAccountId,
              OR: [
                { mobile: { contains: statusData.contactMobile.slice(-10) } },
                { name: { contains: statusData.contactName, mode: 'insensitive' } },
              ],
            },
          });

          // Deduplicate
          const existing = await prisma.status.findFirst({
            where: {
              businessAccountId: req.businessAccountId!,
              contactMobile: normalizeMobile(statusData.contactMobile),
              statusText: statusData.statusText,
              timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },  // 7-day dedup window
            },
          });
          if (existing) continue;

          // Save to DB
          const saved = await prisma.status.create({
            data: {
              businessAccountId: req.businessAccountId!,
              contactId: contact?.id ?? null,
              contactName: contact?.name || statusData.contactName,
              contactMobile: normalizeMobile(statusData.contactMobile || contact?.mobile || ''),
              statusText: statusData.statusText,
              timestamp: statusData.timestamp,
            } as any,
          });

          // Detect event inline (no queue needed)
          const detection = detectEvent(statusData.statusText);
          await prisma.status.update({
            where: { id: saved.id },
            data: {
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
              metadata: { eventType: detection.eventType },
            },
          });

          // Try queue AI reply (works if Redis running)
          if (detection.eventType && shouldGenerateReply(detection.eventType)) {
            try {
              await aiReplyQueue.add('generate', {
                statusId: saved.id,
                contactId: contact?.id ?? null,
                businessAccountId: req.businessAccountId,
                eventType: detection.eventType,
                statusType: statusData.statusType || 'text',
              });
            } catch {
              // Redis not available — skip queue, user can generate manually
            }
          }

          totalNew++;
        }
      } catch (err) {
        const msg = (err as Error).message;
        errors.push(`Session ${session.sessionId.slice(0,8)}: ${msg}`);
        logger.error(`Direct scrape error for ${session.sessionId}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        newStatuses: totalNew,
        sessions: sessions.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: totalNew > 0
        ? `Found ${totalNew} new status update${totalNew !== 1 ? 's' : ''}! Check Status Monitor.`
        : 'No new statuses found. Make sure contacts have posted statuses recently.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
