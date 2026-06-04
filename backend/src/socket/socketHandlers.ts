import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/auth';
import { sessionManager } from '../services/automation/whatsappAutomation';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

const authenticateSocket = (socket: Socket) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return null;
    return verifyToken(token);
  } catch { return null; }
};

export const setupSocketHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    const user = authenticateSocket(socket);
    if (!user) {
      socket.emit('wa:error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    // ── wa:connect ────────────────────────────────────────────────────────
    socket.on('wa:connect', async ({ businessAccountId }: { businessAccountId: string }) => {
      try {
        // Verify ownership
        const account = await prisma.businessAccount.findFirst({
          where: { id: businessAccountId, userId: user.userId },
        });
        if (!account) {
          socket.emit('wa:error', { message: 'Business account not found' });
          return;
        }

        const sessionId = uuid();

        // DB record
        const dbSession = await prisma.whatsappSession.create({
          data: { businessAccountId, sessionId, status: 'QR_PENDING' },
        });

        socket.emit('wa:session_created', {
          sessionDbId: dbSession.id,
          sessionId,
          message: 'Initializing WhatsApp connection…',
        });

        logger.info(`[${sessionId}] Starting Baileys session`);

        // Start — pass callbacks immediately so QR/connected events don't get missed
        const managed = await sessionManager.startSession(sessionId, dbSession.id, {
          onQR: (qrBase64: string) => {
            logger.info(`[${sessionId}] Pushing QR to socket ${socket.id}`);
            socket.emit('wa:qr', { qrBase64, sessionDbId: dbSession.id });
          },
          onReady: async ({ phone, name }) => {
            try {
              await prisma.whatsappSession.update({
                where: { id: dbSession.id },
                data: { status: 'CONNECTED', lastConnectedAt: new Date(), phoneNumber: phone, profileName: name },
              });
              socket.emit('wa:connected', {
                sessionDbId: dbSession.id, phone, name,
                message: `WhatsApp connected!${name ? ` Hi, ${name}!` : ''}`,
              });
            } catch (err) {
              logger.error('DB update on ready failed:', err);
            }
          },
          onAuthFailure: async (msg: string) => {
            await prisma.whatsappSession.update({
              where: { id: dbSession.id }, data: { status: 'FAILED' },
            }).catch(() => {});
            socket.emit('wa:error', { message: msg || 'WhatsApp connection failed', sessionDbId: dbSession.id });
          },
          onDisconnected: async (reason: string) => {
            await prisma.whatsappSession.update({
              where: { id: dbSession.id }, data: { status: 'DISCONNECTED', lastDisconnectedAt: new Date() },
            }).catch(() => {});
            socket.emit('wa:disconnected', { reason, sessionDbId: dbSession.id });
          },
        });

        // If QR was generated before socket subscribed, replay it
        if (managed.qrBase64 && managed.state === 'qr_pending') {
          socket.emit('wa:qr', { qrBase64: managed.qrBase64, sessionDbId: dbSession.id });
        }

      } catch (err) {
        logger.error('wa:connect error:', err);
        socket.emit('wa:error', { message: 'Failed to start WhatsApp session' });
      }
    });

    // ── wa:disconnect ─────────────────────────────────────────────────────
    socket.on('wa:disconnect', async ({ sessionDbId }: { sessionDbId: string }) => {
      try {
        const dbSession = await prisma.whatsappSession.findUnique({
          where: { id: sessionDbId },
        });
        if (!dbSession) return;

        await sessionManager.destroySession(dbSession.sessionId);
        await prisma.whatsappSession.update({
          where: { id: sessionDbId },
          data: { status: 'DISCONNECTED', lastDisconnectedAt: new Date() },
        });
        socket.emit('wa:disconnected', { sessionDbId, reason: 'Manual disconnect' });
      } catch (err) {
        logger.error('wa:disconnect error:', err);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};
