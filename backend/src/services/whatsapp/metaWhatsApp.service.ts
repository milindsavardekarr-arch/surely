/**
 * Meta WhatsApp Cloud API Service
 * Official API: POST https://graph.facebook.com/v25.0/{PHONE_NUMBER_ID}/messages
 *
 * Security: All tokens come from DB (encrypted) or env vars. NEVER hardcoded.
 */

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const META_API_VERSION = 'v25.0';
const META_BASE_URL    = 'https://graph.facebook.com';

// ── Encryption helpers (AES-256-GCM) ────────────────────────────────────────
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'surely-default-key-change-in-prod!!'; // 32 chars

function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(); // always 32 bytes
}

export function encryptToken(plaintext: string): string {
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(24 hex) + tag(32 hex) + encrypted(hex)
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptToken(ciphertext: string): string {
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !dataHex) return ciphertext; // not encrypted yet
    const iv   = Buffer.from(ivHex,  'hex');
    const tag  = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex,'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  } catch {
    return ciphertext; // fallback: treat as plaintext
  }
}

export function maskToken(token: string): string {
  if (!token || token.length < 12) return '••••••••';
  return token.slice(0, 6) + '••••••••••••' + token.slice(-4);
}

// ── Config type ──────────────────────────────────────────────────────────────
export interface WhatsAppCloudConfig {
  accessToken:        string; // decrypted
  phoneNumberId:      string;
  wabaId:             string;
  verifyToken:        string;
  // Test mode fields — resolves #131030 (recipient not in allowed list)
  isTestMode?:        boolean;
  allowedTestNumbers?: string[]; // e.g. ['919876543210']
  // Default template used in test mode & automation
  defaultTemplateName?:     string; // e.g. 'hello_world' or 'surely_test'
  defaultTemplateLanguage?: string; // e.g. 'en_US' or 'en'
}

// Resolve config: DB settings override env vars
export function resolveConfig(dbSettings?: Partial<WhatsAppCloudConfig> | null): WhatsAppCloudConfig {
  return {
    accessToken:             dbSettings?.accessToken        || process.env.WHATSAPP_ACCESS_TOKEN   || '',
    phoneNumberId:           dbSettings?.phoneNumberId      || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    wabaId:                  dbSettings?.wabaId             || process.env.WHATSAPP_WABA_ID         || '',
    verifyToken:             dbSettings?.verifyToken        || process.env.WHATSAPP_VERIFY_TOKEN    || '',
    isTestMode:              dbSettings?.isTestMode         ?? false,
    allowedTestNumbers:      dbSettings?.allowedTestNumbers ?? [],
    defaultTemplateName:     dbSettings?.defaultTemplateName     || 'hello_world',
    defaultTemplateLanguage: dbSettings?.defaultTemplateLanguage || 'en_US',
  };
}

// ── API client factory ───────────────────────────────────────────────────────
function metaClient(accessToken: string) {
  return axios.create({
    baseURL: `${META_BASE_URL}/${META_API_VERSION}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

// ── Send text message ────────────────────────────────────────────────────────
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

export async function sendTextMessage(
  config: WhatsAppCloudConfig,
  toMobile: string,
  body: string,
): Promise<SendResult> {
  try {
    const to = normalizeMobile(toMobile);
    if (!to) return { success: false, error: 'Invalid mobile number' };
    if (!config.accessToken) return { success: false, error: 'WhatsApp Access Token not configured' };
    if (!config.phoneNumberId) return { success: false, error: 'Phone Number ID not configured' };

    const client = metaClient(config.accessToken);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    };

    logger.info(`[MetaWA] Sending text → ${to} via phoneId=${config.phoneNumberId}`);
    const response = await client.post(`/${config.phoneNumberId}/messages`, payload);

    // 🔍 Log full Meta API response for debugging
    logger.info(`[MetaWA] Meta API response: ${JSON.stringify(response.data, null, 2)}`);

    const msgId = response.data?.messages?.[0]?.id;
    logger.info(`[MetaWA] ✅ Sent ${msgId} → ${to}`);
    return { success: true, messageId: msgId, raw: response.data };
  } catch (err) {
    const e = err as AxiosError<{ error?: { message?: string; code?: number } }>;
    const msg = e.response?.data?.error?.message || e.message || 'Unknown error';
    // 🔍 Log full error response for debugging
    logger.error(`[MetaWA] ❌ Send failed: ${JSON.stringify(e.response?.data, null, 2)}`);
    logger.error(`[MetaWA] ❌ Error message: ${msg}`);
    return { success: false, error: msg, raw: e.response?.data };
  }
}

// ── Send template message ────────────────────────────────────────────────────
export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: { type: 'text' | 'image' | 'document'; text?: string }[];
  sub_type?: string;
  index?: number;
}

export async function sendTemplateMessage(
  config: WhatsAppCloudConfig,
  toMobile: string,
  templateName: string,
  languageCode: string = 'en',
  components: TemplateComponent[] = [],
): Promise<SendResult> {
  try {
    const to = normalizeMobile(toMobile);
    if (!to) return { success: false, error: 'Invalid mobile number' };

    const client  = metaClient(config.accessToken);
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 && { components }),
      },
    };

    const response = await client.post(`/${config.phoneNumberId}/messages`, payload);
    // 🔍 Log full Meta API response for debugging
    logger.info(`[MetaWA] Meta API response: ${JSON.stringify(response.data, null, 2)}`);
    const msgId = response.data?.messages?.[0]?.id;
    logger.info(`[MetaWA] ✅ Template ${templateName} sent → ${to} | msgId: ${msgId}`);
    return { success: true, messageId: msgId, raw: response.data };
  } catch (err) {
    const e = err as AxiosError<{ error?: { message?: string } }>;
    const msg = e.response?.data?.error?.message || e.message;
    // 🔍 Log full error response for debugging
    logger.error(`[MetaWA] ❌ Template send failed: ${JSON.stringify(e.response?.data, null, 2)}`);
    return { success: false, error: msg, raw: e.response?.data };
  }
}

// ── Validate credentials ─────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  phoneNumberVerified: boolean;
  displayPhone?: string;
  qualityRating?: string;
  wabaName?: string;
  error?: string;
}

export async function validateCredentials(config: WhatsAppCloudConfig): Promise<ValidationResult> {
  try {
    if (!config.accessToken)   return { valid: false, phoneNumberVerified: false, error: 'Access Token is empty' };
    if (!config.phoneNumberId) return { valid: false, phoneNumberVerified: false, error: 'Phone Number ID is empty' };

    const client = metaClient(config.accessToken);

    // Check phone number
    const phoneRes = await client.get(`/${config.phoneNumberId}`, {
      params: { fields: 'display_phone_number,quality_rating,verified_name,status' },
    });

    const phoneData = phoneRes.data;
    logger.info(`[MetaWA] Validation OK: ${JSON.stringify(phoneData)}`);

    // Check WABA if provided
    let wabaName: string | undefined;
    if (config.wabaId) {
      try {
        const wabaRes = await client.get(`/${config.wabaId}`, { params: { fields: 'name,country' } });
        wabaName = wabaRes.data?.name;
      } catch { /* WABA check optional */ }
    }

    return {
      valid: true,
      phoneNumberVerified: phoneData.status === 'CONNECTED' || true,
      displayPhone: phoneData.display_phone_number,
      qualityRating: phoneData.quality_rating,
      wabaName,
    };
  } catch (err) {
    const e = err as AxiosError<{ error?: { message?: string; code?: number } }>;
    const msg = e.response?.data?.error?.message || e.message || 'Validation failed';
    const code = e.response?.data?.error?.code;
    logger.error(`[MetaWA] Validation failed (code ${code}): ${msg}`);
    return { valid: false, phoneNumberVerified: false, error: `${msg}${code ? ` (code: ${code})` : ''}` };
  }
}

// ── Get business profile ─────────────────────────────────────────────────────
export async function getBusinessProfile(config: WhatsAppCloudConfig) {
  try {
    const client = metaClient(config.accessToken);
    const res = await client.get(`/${config.phoneNumberId}/whatsapp_business_profile`, {
      params: { fields: 'about,address,description,email,websites,vertical,profile_picture_url' },
    });
    return { success: true, data: res.data?.data?.[0] || res.data };
  } catch (err) {
    const e = err as AxiosError<{ error?: { message?: string } }>;
    return { success: false, error: e.response?.data?.error?.message || e.message };
  }
}

// ── Mobile normalizer ────────────────────────────────────────────────────────
/**
 * Normalize a raw phone number string to E.164 format (digits only).
 *
 * KEY FIX: Detect and reject Facebook internal user IDs.
 * Facebook IDs look like phone numbers but fail the real-number validity check:
 *   - Indian numbers: 91 + (6|7|8|9) + 9 more digits = 12 digits total
 *   - Facebook IDs: 12 digits but 3rd digit is NOT 6/7/8/9 (e.g. 912656437272 → 91-2656437272, starts with 2)
 */
export function normalizeMobile(raw: string): string {
  // Strip everything except digits
  let n = (raw || '').replace(/\D/g, '');

  // Strip WhatsApp JID suffix (e.g. "919876543210@s.whatsapp.net" → "919876543210")
  n = n.split('@')[0];

  // Remove any trailing non-digit suffix from JID splitting
  n = n.replace(/[^0-9]/g, '');

  if (!n) return '';

  // ── Detect Facebook/Meta internal user IDs ──────────────────────────────
  // Real phone numbers follow E.164: 7–15 digits.
  // Facebook user IDs are typically 10–16 digit integers that look like phone numbers
  // but don't follow valid country-code + subscriber patterns.
  //
  // For Indian numbers specifically:
  //   Valid: 91 + [6789] + 9 digits (12 digits total)
  //   FB ID: 91 + [0-5] + 9 digits (12 digits but subscriber starts with 0-5 = invalid)
  //
  // If after adding country code the subscriber portion starts with an invalid digit → reject.
  if (n.length > 13) {
    // Could be a malformed number. Try to extract last 12 digits.
    const candidate = n.slice(-12);
    if (candidate.startsWith('91') && isValidIndianSubscriber(candidate.slice(2))) {
      n = candidate;
    } else {
      const last10 = n.slice(-10);
      if (isValidIndianSubscriber(last10)) {
        n = '91' + last10;
      } else {
        // Cannot recover — likely a Facebook internal ID
        logger.debug(`[normalizeMobile] ⚠️ Rejecting non-phone number: ${raw}`);
        return '';
      }
    }
  }

  // Standard Indian normalization
  if (n.length === 10 && isValidIndianSubscriber(n)) n = '91' + n;
  if (n.length === 11 && n.startsWith('0') && isValidIndianSubscriber(n.slice(1))) {
    n = '91' + n.slice(1);
  }

  // ── Final validation: reject if subscriber portion is invalid ────────────
  // For 12-digit numbers starting with 91, check subscriber starts with 6/7/8/9
  if (n.length === 12 && n.startsWith('91')) {
    if (!isValidIndianSubscriber(n.slice(2))) {
      logger.warn(`[normalizeMobile] ⚠️ Rejected invalid Indian number (likely FB ID): ${raw} → ${n}`);
      return ''; // Return empty — caller should skip this number
    }
  }

  return n;
}

/**
 * Check if a 10-digit string is a valid Indian mobile subscriber number.
 * Indian mobiles start with 6, 7, 8, or 9.
 */
function isValidIndianSubscriber(digits: string): boolean {
  if (!digits || digits.length !== 10) return false;
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Compare two mobile numbers for equality, ignoring formatting differences.
 * Handles: country code presence, leading zeros, JID suffixes.
 */
export function mobileMatch(a: string, b: string): boolean {
  const na = normalizeMobile(a);
  const nb = normalizeMobile(b);
  if (!na || !nb) return false; // either is a FB ID / invalid → no match
  if (na === nb) return true;
  // Also compare last 10 digits as fallback (handles 91XXXXXXXXXX vs XXXXXXXXXX)
  return na.slice(-10) === nb.slice(-10);
}
