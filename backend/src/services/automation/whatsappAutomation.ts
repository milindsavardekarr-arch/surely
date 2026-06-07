import makeWASocket, {
  downloadMediaMessage,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import prisma from '../../config/database';
import { normalizeMobile } from '../whatsapp/metaWhatsApp.service';
import pino from 'pino';

export type StatusType = 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document';

export interface StatusData {
  contactName: string;
  contactMobile: string;
  statusText: string;
  statusType: StatusType;
  mediaUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  timestamp: Date;
}

interface StatusMapEntry extends StatusData {
  imageBase64?: string;
  mimeType?: string;
}

export type SessionState =
  | 'idle' | 'initializing' | 'qr_pending'
  | 'connected' | 'failed' | 'disconnected';

export interface ManagedSession {
  sock: WASocket | null;
  store: { contacts: Record<string, unknown> } | null;
  state: SessionState;
  qrBase64: string | null;
  phoneNumber: string | null;
  profileName: string | null;
  dbId: string;
  authDir: string;
  statusMap: Map<string, StatusData>;
  onQR?: (qr: string) => void;
  onReady?: (info: { phone: string | null; name: string | null }) => void;
  onDisconnected?: (reason: string) => void;
  onAuthFailure?: (msg: string) => void;
}

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(process.cwd(), '.wa_sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const baileysLogger = pino({ level: 'silent' });

// ── Facebook internal ID detection ───────────────────────────────────────────
//
// Problem: Facebook/Meta assigns internal user IDs (wa_id) that can look like
// phone numbers but are NOT dialable numbers. Example: 912656437272
//   - 12 digits, starts with 91 → looks like Indian number
//   - But subscriber part is "2656437272" starting with 2 → INVALID (Indian mobiles start with 6-9)
//
// Fix: Use the same validation logic as normalizeMobile in metaWhatsApp.service.ts
//   Valid Indian mobile: 91 + [6789] + 9 digits (12 digits total)
//   Facebook ID: 91 + [0-5] + 9 digits (subscriber starts with invalid digit)
//
function isInternalId(digits: string): boolean {
  if (!digits || digits.length < 7) return true;   // too short to be a real number
  if (digits.length > 15) return true;             // too long for any E.164 phone number

  // For Indian numbers (most common in this app):
  // Pattern after normalization should be 91 + [6-9] + 9 digits
  let n = digits;

  // Handle 10-digit raw subscriber
  if (n.length === 10) n = '91' + n;
  // Handle 11-digit with leading 0
  if (n.length === 11 && n.startsWith('0')) n = '91' + n.slice(1);

  // For 12-digit numbers starting with 91: validate subscriber portion
  if (n.length === 12 && n.startsWith('91')) {
    const subscriber = n.slice(2); // last 10 digits
    // Indian mobile subscriber must start with 6, 7, 8, or 9
    if (!/^[6-9]\d{9}$/.test(subscriber)) {
      return true; // It's a Facebook internal ID, not a real phone number
    }
    return false; // Valid Indian mobile number
  }

  // For other valid international lengths (7-15 digits), allow through
  // They'll be validated by the Meta API itself
  return false;
}

// ── Extract status content from Baileys message ───────────────────────────────
function extractStatusData(msg: proto.IWebMessageInfo): { text: string; type: StatusType; hasMedia?: boolean; mimeType?: string } | null {
  const m = msg.message;
  if (!m) return null;

  if (m.conversation)              return { text: m.conversation, type: 'text' };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, type: 'text' };
  if (m.imageMessage)              return { text: m.imageMessage.caption || '', type: 'image', hasMedia: true, mimeType: m.imageMessage.mimetype || 'image/jpeg' };
  if (m.videoMessage)              return { text: m.videoMessage.caption || '[Video Status]', type: 'video' };
  if (m.audioMessage || (m as {pttMessage?: unknown}).pttMessage) return { text: '[Voice/Audio Status]', type: 'audio' };
  if (m.stickerMessage)            return { text: '[Sticker Status]', type: 'sticker', hasMedia: true, mimeType: 'image/webp' };
  if (m.documentMessage)           return { text: m.documentMessage.caption || `[Document: ${m.documentMessage.fileName || 'file'}]`, type: 'document' };
  if ((m as {templateMessage?: {hydratedTemplate?: {hydratedContentText?: string}}}).templateMessage?.hydratedTemplate?.hydratedContentText)
    return { text: (m as {templateMessage?: {hydratedTemplate?: {hydratedContentText?: string}}}).templateMessage!.hydratedTemplate!.hydratedContentText!, type: 'text' };
  return null;
}

// ── Download image from Baileys message ──────────────────────────────────────
async function downloadImageFromMsg(sock: WASocket, msg: proto.IWebMessageInfo): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger as never, reuploadRequest: sock.updateMediaMessage });
    if (!buffer || !Buffer.isBuffer(buffer)) return null;
    const m = msg.message;
    const mimeType = m?.imageMessage?.mimetype || m?.stickerMessage?.mimetype || 'image/jpeg';
    return { base64: buffer.toString('base64'), mimeType };
  } catch (err) {
    logger.warn('[ImageDownload] Failed:', (err as Error).message);
    return null;
  }
}

class WhatsAppSessionManager {
  private sessions = new Map<string, ManagedSession>();

  async startSession(
    sessionId: string,
    dbId: string,
    callbacks?: {
      onQR?: (qr: string) => void;
      onReady?: (info: { phone: string | null; name: string | null }) => void;
      onDisconnected?: (reason: string) => void;
      onAuthFailure?: (msg: string) => void;
    }
  ): Promise<ManagedSession> {
    if (this.sessions.has(sessionId)) await this.destroySession(sessionId);

    const authDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const managed: ManagedSession = {
      sock: null, store: null, state: 'initializing',
      qrBase64: null, phoneNumber: null, profileName: null,
      dbId, authDir, statusMap: new Map(),
      // Set callbacks immediately so _connect can fire them as soon as events arrive
      onQR: callbacks?.onQR,
      onReady: callbacks?.onReady,
      onDisconnected: callbacks?.onDisconnected,
      onAuthFailure: callbacks?.onAuthFailure,
    };
    this.sessions.set(sessionId, managed);

    this._connect(sessionId, managed, authDir).catch((err) => {
      logger.error(`[${sessionId}] Connect error:`, err);
      managed.state = 'failed';
      managed.onAuthFailure?.('Connection failed: ' + (err as Error).message);
    });

    return managed;
  }

  async restoreSession(
    sessionId: string,
    dbId: string,
    callbacks?: {
      onQR?: (qr: string) => void;
      onReady?: (info: { phone: string | null; name: string | null }) => void;
      onDisconnected?: (reason: string) => void;
      onAuthFailure?: (msg: string) => void;
    }
  ): Promise<ManagedSession | null> {
    const authDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(authDir)) return null;
    if (!fs.existsSync(path.join(authDir, 'creds.json'))) return null;
    logger.info(`[${sessionId}] Restoring persisted session…`);
    return this.startSession(sessionId, dbId, callbacks);
  }

  private async _connect(sessionId: string, managed: ManagedSession, authDir: string): Promise<void> {
    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`[${sessionId}] Baileys v${version.join('.')}`);

    const store: { contacts: Record<string, unknown> } = { contacts: {} };
    managed.store = store;

    const sock = makeWASocket({
      version,
      logger: baileysLogger,
      printQRInTerminal: false,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger),
      },
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,  // more frequent keepalive for persistent connection
      retryRequestDelayMs: 250,
      defaultQueryTimeoutMs: 30000,
      browser: ['Surely AI Platform', 'Chrome', '120.0'],
    });

    managed.sock = sock;

    // ── Connection updates ─────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          logger.info(`[${sessionId}] QR received`);
          const dataUrl = await qrcode.toDataURL(qr, { scale: 8, margin: 2 });
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
          managed.qrBase64 = base64;
          managed.state = 'qr_pending';
          managed.onQR?.(base64);
        } catch (err) {
          logger.error(`[${sessionId}] QR error:`, err);
        }
      }

      if (connection === 'open') {
        managed.state = 'connected';
        const me = sock.user;
        managed.phoneNumber = me?.id?.split(':')[0] || me?.id?.split('@')[0] || null;
        managed.profileName = me?.name || null;
        logger.info(`[${sessionId}] ✅ Connected — ${managed.profileName} (+${managed.phoneNumber})`);
        managed.onReady?.({ phone: managed.phoneNumber, name: managed.profileName });

        // ── FIX 2: Subscribe to status@broadcast on connect ────────────────
        // This is CRITICAL — without this Baileys won't deliver status updates
        try {
          await sock.subscribeNewsletterUpdates?.('status@broadcast' as never);
        } catch { /* not all versions support this, ignore */ }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        logger.warn(`[${sessionId}] Connection closed — code: ${statusCode}`);

        if (loggedOut) {
          // User explicitly logged out — clear files
          managed.state = 'failed';
          fs.rmSync(authDir, { recursive: true, force: true });
          managed.onAuthFailure?.('Logged out from WhatsApp. Please scan QR again.');
        } else if (managed.state !== 'disconnected') {
          // Network/transient — AUTO RECONNECT (never expires on its own)
          managed.state = 'disconnected';
          managed.onDisconnected?.('Connection lost, reconnecting…');
          const delay = statusCode === 408 ? 5000 : 3000; // longer wait on timeout
          setTimeout(() => {
            if (this.sessions.has(sessionId)) {
              logger.info(`[${sessionId}] Auto-reconnecting (persistent login)…`);
              this._connect(sessionId, managed, authDir).catch((err) => {
                logger.error(`[${sessionId}] Reconnect error:`, err);
              });
            }
          }, delay);
        }
      }
    });

    // ── FIX 3: Status updates — correct event handling ─────────────────────
    // Baileys delivers WhatsApp statuses (Stories) via messages.upsert with
    // remoteJid === 'status@broadcast'. The sender is in key.participant.
    sock.ev.on('messages.upsert', (upsert) => {
      // Accept both 'notify' and 'append' — some Baileys versions use 'append' for statuses
      if (upsert.type !== 'notify' && upsert.type !== 'append') return;

      // Process each message asynchronously so we can download images
      const processMessages = async () => {
      for (const msg of upsert.messages) {
        const jid = msg.key?.remoteJid;

        // ── Process status@broadcast messages ──────────────────────────────
        if (jid === 'status@broadcast') {
          // sender: participant field has the actual sender JID
          const senderJid = msg.key?.participant || msg.key?.remoteJid || '';
          const rawMobile = senderJid.split('@')[0].split(':')[0];
          const digits = rawMobile.replace(/\D/g, '');

          if (!digits || digits === 'status' || isInternalId(digits)) {
            logger.debug(`[${sessionId}] Skipping status from non-phone JID: ${senderJid}`);
            continue;
          }

          const extracted = extractStatusData(msg);
          if (!extracted) {
            logger.debug(`[${sessionId}] Could not extract status content from ${rawMobile}`);
            continue;
          }

          logger.info(`[${sessionId}] 📱 Status [${extracted.type}] from ${digits}: "${extracted.text.substring(0, 60)}"`);

          const contactJid = `${digits}@s.whatsapp.net`;
          const contact = store.contacts?.[contactJid] as { name?: string; notify?: string } | undefined;
          const name = contact?.name || contact?.notify || digits;

          // ── Download image for AI vision analysis ─────────────────────
          let imageBase64: string | undefined;
          let mimeType: string | undefined;
          if (extracted.hasMedia && (extracted.type === 'image' || extracted.type === 'sticker')) {
            const downloaded = await downloadImageFromMsg(sock, msg);
            if (downloaded) {
              imageBase64 = downloaded.base64;
              mimeType = downloaded.mimeType;
              logger.info(`[${sessionId}] 📸 Image downloaded from ${digits} (${Math.round(downloaded.base64.length * 0.75 / 1024)}KB)`);
            }
          }

          managed.statusMap.set(digits, {
            contactName: name,
            contactMobile: normalizeMobile(digits),
            statusText: extracted.text.trim(),
            statusType: extracted.type,
            imageBase64,
            mimeType,
            timestamp: new Date(Number(msg.messageTimestamp || 0) * 1000 || Date.now()),
          });

          // ── Save status REPLY as incoming message ─────────────────────
          if (!msg.key?.fromMe) {
            const replyText = msg.message?.extendedTextMessage?.text || msg.message?.conversation || extracted.text;
            const realMobile = normalizeMobile(digits);
            if (replyText && realMobile) {
              try {
                const dbSess = await prisma.whatsappSession.findMany({
                  where: { sessionId }, select: { businessAccountId: true },
                });
                const baId = dbSess[0]?.businessAccountId;
                if (baId) {
                  const waId = msg.key?.id || null;
                  const dup = waId ? await prisma.incomingMessage.findFirst({ where: { waMessageId: waId } }) : null;
                  if (!dup) {
                    const { v4: uuid } = await import('uuid');
                    const contactJid2 = `${digits}@s.whatsapp.net`;
                    const ct = store.contacts?.[contactJid2] as { name?: string; notify?: string } | undefined;
                    const fromName = ct?.name || ct?.notify || msg.pushName || name;
                    const saved = await prisma.incomingMessage.create({
                      data: {
                        id: uuid(), businessAccountId: baId, contactId: null,
                        fromMobile: realMobile, fromName,
                        messageText: replyText, messageType: 'text',
                        waMessageId: waId, source: 'baileys',
                        receivedAt: new Date(Number(msg.messageTimestamp || 0) * 1000 || Date.now()),
                      },
                    });
                    const linkedContact = await prisma.contact.findFirst({
                      where: { businessAccountId: baId, mobile: { contains: digits.slice(-10) } },
                    }).catch(() => null);
                    if (linkedContact) {
                      await prisma.incomingMessage.update({ where: { id: saved.id }, data: { contactId: linkedContact.id } }).catch(() => {});
                    }
                    logger.info(`[${sessionId}] 💬 Status reply saved from ${realMobile}: "${replyText.substring(0, 40)}"`);
                    try {
                      const { io } = await import('../../index') as unknown as { io: { emit: (e: string, d: unknown) => void } | null };
                      if (io) io.emit(`conversation:${baId}`, { type: 'new_message', message: { id: saved.id, type: 'incoming', text: replyText, msgType: 'text', time: saved.receivedAt, isRead: false, source: 'baileys', fromMobile: realMobile, fromName } });
                    } catch {}
                  }
                }
              } catch (e) { logger.error(`[${sessionId}] Failed to save status reply:`, e); }
            }
          }
          // ─────────────────────────────────────────────────────────────
        }

        // ── Also capture regular incoming messages for contact store ────────
        if (jid && jid !== 'status@broadcast' && !jid.endsWith('@g.us')) {
          const senderDigits = jid.split('@')[0].replace(/\D/g, '');
          if (senderDigits && !isInternalId(senderDigits)) {
            const existingContact = store.contacts[jid] as { name?: string; notify?: string } | undefined;
            if (!existingContact?.name) {
              store.contacts[jid] = {
                ...(existingContact || {}),
                id: jid,
                notify: msg.pushName || senderDigits,
              };
            }
          }
        }
      }
      }; // end processMessages
      processMessages().catch(err => logger.error(`[${sessionId}] messages.upsert async error:`, err));
    });

    // ── Contact about/status text updates ─────────────────────────────────
    sock.ev.on('contacts.update', (updates) => {
      for (const update of updates) {
        if (update.status && update.id) {
          const mobile = update.id.split('@')[0].split(':')[0];
          const digits = mobile.replace(/\D/g, '');
          if (digits && !isInternalId(digits) && update.status.trim().length > 3) {
            logger.info(`[${sessionId}] About updated: ${digits} → "${update.status.substring(0, 50)}"`);
            managed.statusMap.set(digits + '_about', {
              contactName: digits,
              contactMobile: normalizeMobile(digits),
              statusText: update.status.trim(),
              statusType: 'text',
              timestamp: new Date(),
            });
          }
        }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts) {
        if (contact?.id) store.contacts[contact.id] = contact;
      }
    });

    // ── FIX 4: Receive contacts on connection (full sync) ──────────────────
    sock.ev.on('messaging-history.set', ({ contacts: historyContacts }) => {
      if (historyContacts) {
        for (const contact of historyContacts) {
          if ((contact as {id?: string}).id) store.contacts[(contact as {id: string}).id] = contact;
        }
        logger.info(`[${sessionId}] Loaded ${historyContacts.length} contacts from history sync`);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  }

  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  isConnected(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.state === 'connected';
  }

  async sendMessage(sessionId: string, mobile: string, message: string): Promise<boolean> {
    const managed = this.sessions.get(sessionId);
    if (!managed?.sock || managed.state !== 'connected') {
      logger.error(`[${sessionId}] Cannot send — not connected (state: ${managed?.state})`);
      return false;
    }
    try {
      let cleaned = mobile.replace(/\D/g, '');
      if (cleaned.length === 10) cleaned = '91' + cleaned;
      if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = '91' + cleaned.slice(1);
      const jid = `${cleaned}@s.whatsapp.net`;
      logger.info(`[${sessionId}] Sending → ${jid}`);
      await managed.sock.sendMessage(jid, { text: message });
      logger.info(`[${sessionId}] ✅ Sent → ${jid}`);
      return true;
    } catch (err) {
      logger.error(`[${sessionId}] Send failed to ${mobile}:`, err);
      return false;
    }
  }

  // ── Get single status data from in-memory map (for vision on-demand) ────
  getStatusData(sessionId: string, mobile: string): StatusData | undefined {
    const managed = this.sessions.get(sessionId);
    if (!managed) return undefined;
    // Try exact match first, then last-10-digits match
    const direct = managed.statusMap.get(mobile);
    if (direct) return direct;
    const last10 = mobile.slice(-10);
    for (const [key, val] of managed.statusMap.entries()) {
      if (key.slice(-10) === last10) return val;
    }
    return undefined;
  }

  // ── FIX 5: Improved scrapeStatuses ────────────────────────────────────────
  async scrapeStatuses(sessionId: string): Promise<StatusData[]> {
    const managed = this.sessions.get(sessionId);
    if (!managed?.sock || managed.state !== 'connected') {
      logger.warn(`[${sessionId}] Not connected — cannot scrape`);
      return [];
    }

    const results: StatusData[] = [];
    const seen = new Set<string>();

    const SKIP_ABOUT = [
      'hey there! i am using whatsapp', 'available', 'busy',
      'at school', 'at the gym', 'battery about to die',
      'urgent calls only', 'at work',
    ];

    // ── Part 1: Real-time statuses collected since connect ─────────────────
    logger.info(`[${sessionId}] statusMap has ${managed.statusMap.size} entries`);
    for (const [key, data] of managed.statusMap.entries()) {
      if (!data.statusText || data.statusText.trim().length < 2) continue;

      const isAbout = key.endsWith('_about');
      const mobile  = isAbout ? key.replace('_about', '') : key;

      if (isAbout && SKIP_ABOUT.some(s => data.statusText.toLowerCase().startsWith(s))) continue;
      if (seen.has(mobile)) continue;
      seen.add(mobile);

      const contactJid = `${mobile}@s.whatsapp.net`;
      const contact = managed.store?.contacts?.[contactJid] as { name?: string; notify?: string } | undefined;
      const name = contact?.name || contact?.notify || data.contactName || mobile;

      results.push({
        contactName: name,
        contactMobile: normalizeMobile(mobile),
        statusText: data.statusText,
        statusType: data.statusType,
        imageBase64: data.imageBase64,   // pass through for vision analysis
        mimeType: data.mimeType,
        timestamp: data.timestamp,
      });
    }

    // ── Part 2: Fetch About text for known contacts ────────────────────────
    try {
      const allContacts = Object.values(managed.store?.contacts || {}) as Array<{id?: string; name?: string; notify?: string}>;
      const batch = allContacts
        .filter(c => c?.id && !c.id.endsWith('@g.us') && !c.id.includes('status'))
        .slice(0, 100); // fetch more contacts

      logger.info(`[${sessionId}] Fetching About for ${batch.length} contacts`);

      for (const contact of batch) {
        if (!contact?.id) continue;
        try {
          const mobile = contact.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          if (!mobile || isInternalId(mobile)) continue;

          const [statusResult] = await (managed.sock.fetchStatus(contact.id) as Promise<Array<{status?: string} | null>>).catch(() => [null]);
          const aboutText = statusResult?.status;

          if (!aboutText || aboutText.trim().length < 4) continue;
          if (SKIP_ABOUT.some(s => aboutText.toLowerCase().startsWith(s))) continue;

          const name = contact.name || contact.notify || mobile;
          logger.info(`[${sessionId}] About for ${name}: "${aboutText.substring(0, 40)}"`);

          if (!seen.has(mobile)) {
            seen.add(mobile);
            results.push({
              contactName: name,
              contactMobile: normalizeMobile(mobile),
              statusText: aboutText.trim(),
              statusType: 'text',
              timestamp: new Date(),
            });
          }
        } catch { /* skip individual errors */ }
      }
    } catch (err) {
      logger.error(`[${sessionId}] About fetch error:`, err);
    }

    logger.info(`[${sessionId}] Total statuses to process: ${results.length}`);
    return results;
  }

  async destroySession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (managed?.sock) {
      try { managed.state = 'disconnected'; managed.sock.end(undefined); } catch { /* ignore */ }
    }
    this.sessions.delete(sessionId);
    logger.info(`[${sessionId}] Session destroyed`);
  }

  static deleteSessionFiles(sessionId: string): void {
    const p = path.join(SESSIONS_DIR, sessionId);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      logger.info(`Session files deleted: ${sessionId}`);
    }
  }
}

export const sessionManager = new WhatsAppSessionManager();
export { WhatsAppSessionManager as WhatsAppAutomation };