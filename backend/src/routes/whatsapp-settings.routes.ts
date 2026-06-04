/**
 * WhatsApp Cloud API Settings Routes
 * All routes are authenticated via JWT middleware.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireBusinessAccount } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import {
  encryptToken, decryptToken, maskToken,
  validateCredentials, sendTextMessage, sendTemplateMessage, getBusinessProfile,
  resolveConfig, normalizeMobile,
} from '../services/whatsapp/metaWhatsApp.service';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireBusinessAccount);

// Guard: ensure businessAccountId is present
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.businessAccountId) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Please log out and log back in.', code: 'MISSING_BUSINESS_ACCOUNT' },
    });
    return;
  }
  next();
});

// ── GET / — fetch settings (tokens always masked) ────────────────────────────
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bizId = req.businessAccountId!;

    let row = await prisma.whatsAppApiSettings.findUnique({
      where: { businessAccountId: bizId },
    });

    // Auto-create with defaults on first visit
    if (!row) {
      row = await prisma.whatsAppApiSettings.create({
        data: { businessAccountId: bizId },
      });
    }

    const decrypted = row.accessTokenEncrypted ? decryptToken(row.accessTokenEncrypted) : '';

    // Parse allowedTestNumbers from JSON string
    let allowedTestNumbers: string[] = [];
    try { allowedTestNumbers = JSON.parse(row.allowedTestNumbers || '[]'); } catch { allowedTestNumbers = []; }

    res.json({
      success: true,
      configured: !!(decrypted && row.phoneNumberId),
      data: {
        id:                     row.id,
        phoneNumberId:          row.phoneNumberId      || '',
        wabaId:                 row.wabaId             || '',
        webhookCallbackUrl:     row.webhookCallbackUrl || '',
        isEnabled:              row.isEnabled,
        isTestMode:             row.isTestMode,
        allowedTestNumbers:     allowedTestNumbers,
        defaultTemplateName:    row.defaultTemplateName    || 'hello_world',
        defaultTemplateLanguage: row.defaultTemplateLanguage || 'en_US',
        accessTokenMask:        decrypted ? maskToken(decrypted) : '',
        verifyTokenSet:         !!(row.verifyToken),
        createdAt:              row.createdAt,
        updatedAt:              row.updatedAt,
      },
    });
  } catch (err) {
    logger.error('[WASettings GET] Error:', err);
    next(err);
  }
});

// ── PUT / — save/update credentials ──────────────────────────────────────────
router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bizId = req.businessAccountId!;

    const schema = z.object({
      accessToken:              z.string().optional(),
      phoneNumberId:            z.string().optional(),
      wabaId:                   z.string().optional(),
      verifyToken:              z.string().optional(),
      webhookCallbackUrl:       z.string().optional(),
      isEnabled:                z.boolean().optional(),
      isTestMode:               z.boolean().optional(),
      allowedTestNumbers:       z.array(z.string()).optional(),
      defaultTemplateName:      z.string().optional(),
      defaultTemplateLanguage:  z.string().optional(),
    });

    const body = schema.parse(req.body);
    const updateData: Record<string, unknown> = {};

    if (body.accessToken && body.accessToken.trim() !== '') {
      updateData.accessTokenEncrypted = encryptToken(body.accessToken.trim());
    }
    if (body.phoneNumberId           !== undefined) updateData.phoneNumberId           = body.phoneNumberId.trim();
    if (body.wabaId                  !== undefined) updateData.wabaId                  = body.wabaId.trim();
    if (body.verifyToken             !== undefined) updateData.verifyToken             = body.verifyToken.trim();
    if (body.webhookCallbackUrl      !== undefined) updateData.webhookCallbackUrl      = body.webhookCallbackUrl.trim();
    if (body.isEnabled               !== undefined) updateData.isEnabled               = body.isEnabled;
    if (body.isTestMode              !== undefined) updateData.isTestMode              = body.isTestMode;
    if (body.defaultTemplateName     !== undefined) updateData.defaultTemplateName     = body.defaultTemplateName.trim() || 'hello_world';
    if (body.defaultTemplateLanguage !== undefined) updateData.defaultTemplateLanguage = body.defaultTemplateLanguage.trim() || 'en_US';
    if (body.allowedTestNumbers !== undefined) {
      // Normalize: strip non-digits, validate as real phone number (not FB internal ID)
      const cleaned = body.allowedTestNumbers
        .map(n => {
          const digits = n.replace(/\D/g, '');
          // Normalize to E.164 Indian format if needed
          let normalized = digits;
          if (normalized.length === 10) normalized = '91' + normalized;
          if (normalized.length === 11 && normalized.startsWith('0')) normalized = '91' + normalized.slice(1);
          // Validate: 12-digit Indian number must have subscriber starting with 6-9
          if (normalized.length === 12 && normalized.startsWith('91')) {
            const subscriber = normalized.slice(2);
            if (!/^[6-9]\d{9}$/.test(subscriber)) return null; // Reject FB ID / invalid number
          }
          if (normalized.length < 10 || normalized.length > 15) return null;
          return normalized;
        })
        .filter((n): n is string => n !== null);
      updateData.allowedTestNumbers = JSON.stringify(cleaned);
    }

    await prisma.whatsAppApiSettings.upsert({
      where:  { businessAccountId: bizId },
      create: { businessAccountId: bizId, ...updateData },
      update: updateData,
    });

    // Audit log (non-blocking)
    prisma.engagementLog.create({
      data: {
        businessAccountId: bizId,
        action: 'WHATSAPP_SETTINGS_UPDATED',
        metadata: {
          fields: Object.keys(updateData).filter(k => k !== 'accessTokenEncrypted'),
        },
      },
    }).catch(() => {});

    logger.info(`[WASettings PUT] Saved for ${bizId} — fields: ${Object.keys(updateData).join(', ')}`);
    res.json({ success: true, message: 'WhatsApp API settings saved successfully' });
  } catch (err) {
    logger.error('[WASettings PUT] Error:', err);
    next(err);
  }
});

// ── POST /test — validate credentials with Meta API ──────────────────────────
router.post('/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bizId = req.businessAccountId!;

    const row = await prisma.whatsAppApiSettings.findUnique({
      where: { businessAccountId: bizId },
    });

    const config = resolveConfig({
      accessToken:   row?.accessTokenEncrypted ? decryptToken(row.accessTokenEncrypted) : undefined,
      phoneNumberId: row?.phoneNumberId || undefined,
      wabaId:        row?.wabaId        || undefined,
      verifyToken:   row?.verifyToken   || undefined,
    });

    if (!config.accessToken) {
      res.json({ success: false, data: { valid: false, phoneNumberVerified: false, error: 'Access Token not saved yet. Fill in the token and click Save Settings first.' } });
      return;
    }
    if (!config.phoneNumberId) {
      res.json({ success: false, data: { valid: false, phoneNumberVerified: false, error: 'Phone Number ID not saved yet. Fill it in and click Save Settings.' } });
      return;
    }

    const result = await validateCredentials(config);

    prisma.engagementLog.create({
      data: { businessAccountId: bizId, action: 'WHATSAPP_CREDENTIALS_TESTED', metadata: { success: result.valid } },
    }).catch(() => {});

    res.json({ success: result.valid, data: result });
  } catch (err) {
    logger.error('[WASettings TEST] Error:', err);
    next(err);
  }
});

// ── POST /send-test — send a real test message ────────────────────────────────
//
// WHY TEMPLATE: Meta WhatsApp Cloud API only allows free-form text (type=text)
// within a 24-hour customer service window (i.e. the recipient must have
// messaged YOU first within the last 24h). Outside that window, Meta silently
// accepts the API call (returns a message ID) but NEVER delivers the message.
//
// Template messages (type=template) bypass the 24h rule and are always
// delivered — this is the correct approach for test/outbound messages.
// "hello_world" (en_US) is Meta's built-in approved template available on
// every new WhatsApp Business account. Swap it for your own approved template
// if hello_world has been removed from your account.
//
router.post('/send-test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bizId = req.businessAccountId!;

    const schema = z.object({
      mobile:       z.string().min(6),
      message:      z.string().min(1).max(4096).optional(),
      templateName: z.string().optional(),
      languageCode: z.string().optional(),
    });
    const { mobile, message, templateName, languageCode } = schema.parse(req.body);

    const row = await prisma.whatsAppApiSettings.findUnique({
      where: { businessAccountId: bizId },
    });

    const config = resolveConfig({
      accessToken:   row?.accessTokenEncrypted ? decryptToken(row.accessTokenEncrypted) : undefined,
      phoneNumberId: row?.phoneNumberId || undefined,
      wabaId:        row?.wabaId        || undefined,
    });

    const to = normalizeMobile(mobile);
    if (!to) {
      res.status(400).json({ success: false, data: { error: `"${mobile}" is not a valid phone number.` } });
      return;
    }

    // Use provided template name or DB default or hello_world
    const template = templateName?.trim() || row?.defaultTemplateName?.trim() || 'hello_world';
    const language = languageCode?.trim() || row?.defaultTemplateLanguage?.trim() || 'en_US';

    logger.info(`[WASettings SEND-TEST] Sending template="${template}" lang="${language}" → ${to} for ${bizId}`);

    // hello_world has no parameters. Templates like surely_test have {{1}} in body.
    // Pass the message text as the first body parameter for non-hello_world templates.
    const isHelloWorld = template === 'hello_world';
    const bodyComponents = isHelloWorld ? [] : [
      {
        type: 'body' as const,
        parameters: [
          { type: 'text' as const, text: (message || 'Test message from Surely 🚀').substring(0, 1024) },
        ],
      },
    ];

    const result = await sendTemplateMessage(config, to, template, language, bodyComponents);

    // Log full Meta API result so we can diagnose delivery issues
    logger.info(`[WASettings SEND-TEST] Meta result: ${JSON.stringify(result.raw, null, 2)}`);

    prisma.engagementLog.create({
      data: {
        businessAccountId: bizId,
        action: 'WHATSAPP_TEST_MESSAGE_SENT',
        metadata: {
          to: to.slice(0, -4) + '****',
          success: result.success,
          messageId: result.messageId,
          template,
          language,
          error: result.error,
        },
      },
    }).catch(() => {});

    if (result.success) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          template,
          note: 'Template message sent. If you need to send custom text, the recipient must message you first (24h window).',
        },
      });
    } else {
      res.status(400).json({ success: false, data: { error: result.error, template } });
    }
  } catch (err) {
    logger.error('[WASettings SEND-TEST] Error:', err);
    next(err);
  }
});

// ── GET /profile — fetch WhatsApp business profile ───────────────────────────
router.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bizId = req.businessAccountId!;
    const row = await prisma.whatsAppApiSettings.findUnique({ where: { businessAccountId: bizId } });
    const config = resolveConfig({
      accessToken:   row?.accessTokenEncrypted ? decryptToken(row.accessTokenEncrypted) : undefined,
      phoneNumberId: row?.phoneNumberId || undefined,
    });
    const result = await getBusinessProfile(config);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
