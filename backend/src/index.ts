import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';

import { logger } from './utils/logger';
import { errorHandler, AppError } from './middleware/errorHandler';
import { setupSocketHandlers } from './socket/socketHandlers';

import authRoutes from './routes/auth.routes';
import contactRoutes from './routes/contacts.routes';
import sessionRoutes from './routes/sessions.routes';
import statusRoutes from './routes/statuses.routes';
import settingsRoutes from './routes/settings.routes';
import whatsappSettingsRoutes from './routes/whatsapp-settings.routes';
import adminApiRoutes from './routes/admin-api.routes';
import replyRoutes from './routes/replies.routes';
import analyticsRoutes from './routes/analytics.routes';
import webhookRoutes from './routes/webhooks.routes';
import automationRoutes from './routes/automation.routes';

import { initWorkers } from './queues/workers';
import prisma from './config/database';
import { sessionManager } from './services/automation/whatsappAutomation';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '4000');

// ── CORS: allow ALL origins in dev, specific in prod ──────────────────────
const isDev = process.env.NODE_ENV !== 'production';

const corsOptions: cors.CorsOptions = {
  origin: isDev
    ? true
    : (process.env.FRONTEND_URL || 'http://localhost:3000'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Socket.io ─────────────────────────────────────────────────────────────
export const io = new SocketServer(server, {
  cors: {
    origin: isDev ? true : (process.env.FRONTEND_URL || 'http://localhost:3000'),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});
setupSocketHandlers(io);

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan('dev'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try { await prisma.$queryRaw`SELECT 1`; dbStatus = 'connected'; } catch { /* ignore */ }
  res.json({
    status: 'ok',
    db: dbStatus,
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp-settings', whatsappSettingsRoutes);
// PHP Admin API — no user auth required, uses ADMIN_API_KEY
app.use('/api/admin-api', adminApiRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/automation', automationRoutes);

app.use((_req, _res, next) => next(new AppError('Route not found', 404)));
app.use(errorHandler);

// ── Restore persisted WhatsApp sessions on startup ────────────────────────
async function restorePersistedSessions(): Promise<void> {
  try {
    const connected = await prisma.whatsappSession.findMany({
      where: { status: 'CONNECTED' },
    });

    if (connected.length === 0) {
      logger.info('No persisted sessions to restore');
      return;
    }

    logger.info(`🔄 Restoring ${connected.length} persisted WhatsApp session(s)…`);
    let restored = 0;

    for (const dbSession of connected) {
      try {
        const managed = await sessionManager.restoreSession(dbSession.sessionId, dbSession.id, {
          onReady: async ({ phone, name }) => {
            await prisma.whatsappSession.update({
              where: { id: dbSession.id },
              data: { status: 'CONNECTED', lastConnectedAt: new Date(), phoneNumber: phone, profileName: name },
            }).catch(() => {});
            logger.info(`[${dbSession.sessionId}] ✅ Session restored — ${name} (+${phone})`);
          },
          onDisconnected: async () => {
            await prisma.whatsappSession.update({
              where: { id: dbSession.id },
              data: { status: 'DISCONNECTED', lastDisconnectedAt: new Date() },
            }).catch(() => {});
          },
          onAuthFailure: async (msg) => {
            await prisma.whatsappSession.update({
              where: { id: dbSession.id },
              data: { status: 'FAILED' },
            }).catch(() => {});
            logger.warn(`[${dbSession.sessionId}] Auth failure on restore: ${msg}`);
          },
        });
        if (managed) {
          restored++;
        } else {
          // No saved credentials — mark as disconnected
          await prisma.whatsappSession.update({
            where: { id: dbSession.id },
            data: { status: 'DISCONNECTED' },
          }).catch(() => {});
        }
      } catch (err) {
        logger.error(`Failed to restore session ${dbSession.sessionId}:`, err);
      }
    }

    logger.info(`✅ Restored ${restored}/${connected.length} sessions`);
  } catch (err) {
    logger.warn('Could not restore sessions (DB may not be ready yet):', (err as Error).message);
  }
}

// ── Start server ──────────────────────────────────────────────────────────
const startServer = (port: number): void => {
  server.listen(port, async () => {
    logger.info(`🚀 Surely AI Backend running on http://localhost:${port}`);
    logger.info(`🌍 CORS: ${isDev ? 'ALL ORIGINS (dev mode)' : process.env.FRONTEND_URL}`);
    logger.info(`🤖 AI Model: ${process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile'} via Groq`);

    // DB check
    try {
      await prisma.$connect();
      logger.info('✅ Database connected');

      // Restore persisted sessions (persistent login)
      await restorePersistedSessions();
    } catch (err) {
      logger.error('❌ DATABASE FAILED — check DATABASE_URL in backend/.env');
      logger.error((err as Error).message);
    }

    // Workers (optional — app works without Redis)
    try {
      await initWorkers();
      logger.info('✅ Queue workers ready');
    } catch (err) {
      logger.warn('⚠️  Workers skipped (Redis not running) — app still works');
      logger.warn((err as Error).message);
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`⚠️  Port ${port} in use — trying ${port + 1}`);
      server.close();
      startServer(port + 1);
    } else {
      logger.error('Server error:', err);
      process.exit(1);
    }
  });
};

startServer(PORT);

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('unhandledRejection', (r) => logger.error('Unhandled rejection:', r));
process.on('uncaughtException', (e) => { logger.error('Uncaught exception:', e); process.exit(1); });

export default app;
