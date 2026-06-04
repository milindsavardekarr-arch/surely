/**
 * WhatsApp Webhook Routes
 *
 * GET  /webhooks/whatsapp — Meta verification handshake
 * POST /webhooks/whatsapp — Incoming messages, statuses, read receipts
 */

import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { detectEvent, shouldGenerateReply } from '../services/ai/eventDetection';
import { statusProcessingQueue } from '../queues/workers';
import { normalizeMobile } from '../services/whatsapp/metaWhatsApp.service';

const router = Router();

// ── GET — Meta webhook verification ──────────────────────────────────────────
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Try DB verify token first, fallback to env
  if (mode === 'subscribe') {
    // Accept both env token and any token (for initial setup)
    const envToken = process.env.WEBHOOK_VERIFY_TOKEN || '';
    if (!envToken || token === envToken) {
      res.status(200).send(challenge);
      return;
    }
  }
  res.sendStatus(403);
});

// ── POST — Incoming Meta webhook events ──────────────────────────────────────
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Always respond 200 immediately — Meta retries if we don't
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body?.object || body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const wabaId  = entry.id;
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;

        // Find which business account this belongs to
        let businessAccountId: string | null = null;
        if (phoneNumberId || wabaId) {
          try {
            // Raw SQL so it works even if new columns aren't migrated yet
            const rows = await prisma.$queryRawUnsafe<Array<{ businessAccountId: string }>>(
              `SELECT "businessAccountId" FROM "WhatsAppApiSettings"
               WHERE "phoneNumberId" = $1 OR "wabaId" = $2 LIMIT 1`,
              phoneNumberId || '', wabaId || ''
            );
            businessAccountId = rows[0]?.businessAccountId || null;
          } catch {
            // fallback: find by wabaId only
            try {
              const row = await prisma.whatsAppApiSettings.findFirst({
                where: { OR: [
                  phoneNumberId ? { phoneNumberId } : {},
                  wabaId ? { wabaId } : {},
                ].filter(o => Object.keys(o).length > 0) },
                select: { businessAccountId: true },
              });
              businessAccountId = row?.businessAccountId || null;
            } catch { /* ignore */ }
          }
        }

        if (!businessAccountId) {
          logger.warn(`[Webhook] No business account for wabaId=${wabaId} phoneId=${phoneNumberId}`);
          continue;
        }

        // ── Handle incoming messages (contact sent you a WhatsApp) ──────────
        const messages = value.messages || [];
        for (const msg of messages) {
          await handleIncomingMessage(msg, value.contacts || [], businessAccountId);
        }

        // ── Handle status updates from Meta (delivery, read receipts) ───────
        // Note: These are MESSAGE status updates (delivered/read), not WhatsApp Stories
        const statuses = value.statuses || [];
        for (const st of statuses) {
          logger.debug(`[Webhook] Message status: ${st.status} for msgId=${st.id} to=${st.recipient_id}`);
        }
      }
    }
  } catch (err) {
    logger.error('[Webhook] Processing error:', err);
  }
});

// ── Handle an incoming user message via Meta API ──────────────────────────────
async function handleIncomingMessage(
  msg: {
    from?: string;
    type?: string;
    text?: { body?: string };
    image?: { caption?: string };
    video?: { caption?: string };
    audio?: unknown;
    document?: { caption?: string; filename?: string };
    timestamp?: string;
  },
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }>,
  businessAccountId: string,
) {
  try {
    const fromRaw  = msg.from || '';
    const fromMobile = normalizeMobile(fromRaw);
    if (!fromMobile) {
      // normalizeMobile returns '' for Facebook internal IDs
      logger.debug(`[Webhook] Skipping message from non-phone ID: "${fromRaw}"`);
      return;
    }

    // Extract message text
    let msgText = '';
    let msgType = msg.type || 'text';
    if (msg.type === 'text')     msgText = msg.text?.body || '';
    if (msg.type === 'image')    msgText = msg.image?.caption || '[Image]';
    if (msg.type === 'video')    msgText = msg.video?.caption || '[Video]';
    if (msg.type === 'audio')    msgText = '[Voice Message]';
    if (msg.type === 'document') msgText = msg.document?.caption || `[Document: ${msg.document?.filename || 'file'}]`;

    if (!msgText) return;

    // Find sender name from contacts array
    const contactInfo = contacts.find(c => c.wa_id === fromRaw);
    const senderName  = contactInfo?.profile?.name || fromMobile;

    logger.info(`[Webhook] Incoming msg from ${fromMobile} (${senderName}): "${msgText.substring(0, 60)}"`);

    // Find or upsert contact
    const contact = await prisma.contact.upsert({
      where: { businessAccountId_mobile: { businessAccountId, mobile: fromMobile } },
      create: { businessAccountId, mobile: fromMobile, name: senderName },
      update: { name: senderName },
    }).catch(async () => {
      return prisma.contact.findFirst({ where: { businessAccountId, mobile: { contains: fromMobile.slice(-10) } } });
    });

    // Check if it looks like a status update / story reply
    const detection = detectEvent(msgText);
    const isEventWorthy = detection.eventType && shouldGenerateReply(detection.eventType);

    // Save as a Status if it contains an event keyword — this feeds the Status Monitor
    if (isEventWorthy) {
      const existing = await prisma.status.findFirst({
        where: {
          businessAccountId,
          contactMobile: fromMobile,
          statusText: msgText,
          timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // dedupe within 1h
        },
      });
      if (!existing) {
        const status = await prisma.status.create({
          data: {
            businessAccountId,
            contactId: contact?.id ?? null,
            contactName: senderName,
            contactMobile: fromMobile,
            statusText: msgText,
            // statusType not in schema yet
            timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
          },
        });
        await statusProcessingQueue.add('process', { statusId: status.id, businessAccountId });
        logger.info(`[Webhook] Created status ${status.id} for event: ${detection.eventType}`);
      }
    }

    // Log the incoming message always
    await prisma.engagementLog.create({
      data: {
        businessAccountId,
        contactId: contact?.id ?? null,
        action: 'STATUS_DETECTED',
        metadata: { from: fromMobile, text: msgText.substring(0, 200), type: msgType },
      },
    }).catch(() => {});

  } catch (err) {
    logger.error('[Webhook] handleIncomingMessage error:', err);
  }
}

export default router;
