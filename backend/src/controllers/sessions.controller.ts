import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { sessionManager, WhatsAppAutomation } from '../services/automation/whatsappAutomation';
import { statusScrapingQueue } from '../queues/workers';
import { logger } from '../utils/logger';

export const listSessions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessions = await prisma.whatsappSession.findMany({
      where: { businessAccountId: req.businessAccountId },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = sessions.map((s) => ({
      ...s,
      liveState: sessionManager.getSession(s.sessionId)?.state || 'offline',
    }));
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

export const getSessionStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await prisma.whatsappSession.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
    });
    if (!session) throw new AppError('Session not found', 404);

    const live = sessionManager.getSession(session.sessionId);
    if (live?.state === 'connected' && session.status !== 'CONNECTED') {
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          status: 'CONNECTED', lastConnectedAt: new Date(),
          phoneNumber: live.phoneNumber, profileName: live.profileName,
        },
      });
      session.status = 'CONNECTED' as never;
    }
    res.json({ success: true, data: { ...session, liveState: live?.state || 'offline' } });
  } catch (err) { next(err); }
};

export const disconnectSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await prisma.whatsappSession.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
    });
    if (!session) throw new AppError('Session not found', 404);

    await sessionManager.destroySession(session.sessionId);
    WhatsAppAutomation.deleteSessionFiles(session.sessionId);

    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { status: 'DISCONNECTED', lastDisconnectedAt: new Date() },
    });
    res.json({ success: true, message: 'Session disconnected' });
  } catch (err) { next(err); }
};

export const triggerStatusScrape = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessions = await prisma.whatsappSession.findMany({
      where: { businessAccountId: req.businessAccountId, status: 'CONNECTED' },
    });
    if (sessions.length === 0) throw new AppError('No connected WhatsApp sessions. Connect first.', 400);

    const jobs = await Promise.all(
      sessions.map((s) => statusScrapingQueue.add('scrape', {
        sessionId: s.sessionId,
        businessAccountId: req.businessAccountId,
      }))
    );
    res.json({ success: true, message: `Scanning ${jobs.length} session(s)`, data: { jobCount: jobs.length } });
  } catch (err) { next(err); }
};
