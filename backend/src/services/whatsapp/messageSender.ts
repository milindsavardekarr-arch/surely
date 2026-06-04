/**
 * Unified Message Sender — Baileys FIRST, Meta API fallback
 *
 * Priority:
 *   1. Baileys (client's own scanned WhatsApp number)
 *      → Direct text, no 24h window, no template restrictions
 *   2. Meta API free-form text (if 24h window open)
 *   3. Meta API template fallback (always delivers)
 *
 * This means: if client has scanned their number → everything just works.
 * Meta API is only used when no Baileys session is connected.
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import {
  sendTextMessage,
  sendTemplateMessage,
  resolveConfig,
  decryptToken,
  normalizeMobile,
  mobileMatch,
} from './metaWhatsApp.service';
import { sessionManager } from '../automation/whatsappAutomation';

export interface SendMessageResult {
  sent: boolean;
  method: 'BAILEYS' | 'META_API' | 'NONE';
  messageId?: string;
  error?: string;
  templateFallback?: boolean;
}

export async function sendWhatsAppMessage(
  businessAccountId: string,
  mobile: string,
  text: string,
): Promise<SendMessageResult> {

  // ── Normalize & validate recipient ───────────────────────────────────────
  const rawDigits = mobile.replace(/\D/g, '').split('@')[0];
  const to = normalizeMobile(mobile);

  if (!to) {
    logger.warn(`[MsgSender] ⚠️ "${rawDigits}" is not a valid phone number — attempting CRM lookup...`);
    const realNumber = await lookupRealNumberFromCRM(businessAccountId, rawDigits);
    if (realNumber) {
      logger.info(`[MsgSender] ✅ CRM lookup resolved "${rawDigits}" → "${realNumber}"`);
      return sendWhatsAppMessage(businessAccountId, realNumber, text);
    }
    const err = `Cannot send to "${rawDigits}" — looks like a Facebook internal ID. Add the actual phone number as a CRM Contact and retry.`;
    logger.error(`[MsgSender] ❌ ${err}`);
    return { sent: false, method: 'NONE', error: err };
  }

  logger.info(`[MsgSender] Sending → ${to} (business=${businessAccountId})`);

  // ── STEP 1: Baileys — client's own scanned number, no restrictions ────────
  try {
    const activeSessions = await prisma.whatsappSession.findMany({
      where: { businessAccountId, status: 'CONNECTED' },
      select: { sessionId: true },
    });

    for (const { sessionId } of activeSessions) {
      const session = sessionManager.getSession(sessionId);
      if (session?.state === 'connected') {
        logger.info(`[MsgSender] 🟢 Baileys session "${sessionId}" connected — sending direct text`);
        const sent = await sessionManager.sendMessage(sessionId, to, text);
        if (sent) {
          logger.info(`[MsgSender] ✅ Sent via Baileys → ${to}`);
          return { sent: true, method: 'BAILEYS' };
        }
        logger.warn(`[MsgSender] Baileys session "${sessionId}" send failed — trying next`);
      }
    }
  } catch (baileyErr) {
    logger.warn(`[MsgSender] Baileys step error: ${baileyErr}`);
  }

  logger.info(`[MsgSender] No Baileys session available — falling back to Meta API`);

  // ── Load Meta API credentials ─────────────────────────────────────────────
  let apiSettings = null;
  try {
    apiSettings = await prisma.whatsAppApiSettings.findUnique({ where: { businessAccountId } });
  } catch (dbErr) {
    logger.warn(`[MsgSender] DB lookup failed: ${dbErr}`);
  }

  const allowedNumbers: string[] = (() => {
    try { return JSON.parse(apiSettings?.allowedTestNumbers || '[]'); }
    catch { return []; }
  })();

  const config = resolveConfig({
    accessToken:             apiSettings?.accessTokenEncrypted
      ? decryptToken(apiSettings.accessTokenEncrypted)
      : undefined,
    phoneNumberId:           apiSettings?.phoneNumberId      || undefined,
    wabaId:                  apiSettings?.wabaId             || undefined,
    verifyToken:             apiSettings?.verifyToken        || undefined,
    isTestMode:              apiSettings?.isTestMode         ?? false,
    allowedTestNumbers:      allowedNumbers,
    defaultTemplateName:     apiSettings?.defaultTemplateName     || undefined,
    defaultTemplateLanguage: apiSettings?.defaultTemplateLanguage || undefined,
  });

  // ── STEP 2: Meta API ──────────────────────────────────────────────────────
  if (!config.accessToken || !config.phoneNumberId) {
    const err = !config.accessToken
      ? 'No Baileys session connected and WhatsApp Access Token not configured. Scan a WhatsApp number in Sessions, or configure Meta API in Settings.'
      : 'No Baileys session connected and Phone Number ID not configured.';
    logger.error(`[MsgSender] ❌ ${err}`);
    return { sent: false, method: 'NONE', error: err };
  }

  if (apiSettings && !apiSettings.isEnabled) {
    const err = 'No Baileys session connected and Meta API is disabled. Enable it in Settings → WhatsApp Setting.';
    logger.error(`[MsgSender] ❌ ${err}`);
    return { sent: false, method: 'NONE', error: err };
  }

  // ── Test mode guard ───────────────────────────────────────────────────────
  if (config.isTestMode) {
    let crmNumbers: string[] = [];
    try {
      const contacts = await prisma.contact.findMany({
        where:  { businessAccountId },
        select: { mobile: true },
      });
      crmNumbers = contacts.map(c => normalizeMobile(c.mobile)).filter(Boolean) as string[];
    } catch (e) {
      logger.warn(`[MsgSender] CRM contacts lookup failed: ${e}`);
    }

    const manualNorm    = allowedNumbers.map(n => normalizeMobile(n)).filter(Boolean) as string[];
    const effectiveList = [...new Set([...manualNorm, ...crmNumbers])];
    const isAllowed     = effectiveList.length === 0 || effectiveList.some(a => mobileMatch(a, to));

    if (!isAllowed) {
      const err = `Test mode: ${to} is not in the allowed list. Add this number in Meta Developer Console → WhatsApp → API Setup "To" field, then add as CRM Contact or in WhatsApp Setting → Allowed Test Numbers.`;
      logger.warn(`[MsgSender] ⚠️ ${err}`);
      return { sent: false, method: 'META_API', error: err };
    }

    // Test mode: must use template
    const tmplName = config.defaultTemplateName || 'hello_world';
    const tmplLang = config.defaultTemplateLanguage || 'en_US';
    logger.info(`[MsgSender] 🧪 Test mode — template "${tmplName}" (${tmplLang}) → ${to}`);
    const components = tmplName === 'hello_world' ? [] : [
      { type: 'body' as const, parameters: [{ type: 'text' as const, text: text.substring(0, 1024) || 'Hello' }] },
    ];
    const tmplResult = await sendTemplateMessage(config, to, tmplName, tmplLang, components);
    if (tmplResult.success) {
      logger.info(`[MsgSender] ✅ Test template sent → ${to}`);
      return { sent: true, method: 'META_API', messageId: tmplResult.messageId, templateFallback: true };
    }
    logger.error(`[MsgSender] ❌ Test template failed: ${tmplResult.error}`);
    return { sent: false, method: 'META_API', error: tmplResult.error || 'Template send failed' };
  }

  // ── Live mode: free-form text first, template fallback ───────────────────
  const textResult = await sendTextMessage(config, to, text);
  if (textResult.success) {
    logger.info(`[MsgSender] ✅ Meta free-form text → ${to}`);
    return { sent: true, method: 'META_API', messageId: textResult.messageId };
  }

  // Template fallback
  logger.warn(`[MsgSender] Free-form failed (${textResult.error}) — trying template`);
  const tmplName = config.defaultTemplateName || 'hello_world';
  const tmplLang = config.defaultTemplateLanguage || 'en_US';
  const components = tmplName === 'hello_world' ? [] : [
    { type: 'body' as const, parameters: [{ type: 'text' as const, text: text.substring(0, 1024) || 'Hello' }] },
  ];
  const tmplResult = await sendTemplateMessage(config, to, tmplName, tmplLang, components);
  if (tmplResult.success) {
    logger.info(`[MsgSender] ✅ Meta template fallback → ${to}`);
    return { sent: true, method: 'META_API', messageId: tmplResult.messageId, templateFallback: true };
  }

  const err = `Text: ${textResult.error} | Template: ${tmplResult.error}`;
  logger.error(`[MsgSender] ❌ All send methods failed: ${err}`);
  return { sent: false, method: 'META_API', error: err };
}

async function lookupRealNumberFromCRM(businessAccountId: string, fbId: string): Promise<string | null> {
  try {
    const contacts = await prisma.contact.findMany({
      where:   { businessAccountId },
      orderBy: { updatedAt: 'desc' },
      take:    10,
      select:  { mobile: true, name: true },
    });
    for (const c of contacts) {
      const n = normalizeMobile(c.mobile);
      if (n) {
        logger.info(`[MsgSender] CRM candidate: ${c.name} → ${n}`);
        return n;
      }
    }
    return null;
  } catch (err) {
    logger.warn(`[MsgSender] CRM lookup error: ${err}`);
    return null;
  }
}
