import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const businessAccountId = req.businessAccountId!;
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalContacts,
      connectedSessions,
      statusesDetected,
      aiRepliesGenerated,
      repliesSent,
      pendingApprovals,
      recentStatuses,
      eventBreakdown,
      replyStatusBreakdown,
      recentEngagement,
    ] = await Promise.all([
      prisma.contact.count({ where: { businessAccountId } }),
      prisma.whatsappSession.count({ where: { businessAccountId, status: 'CONNECTED' } }),
      prisma.status.count({ where: { businessAccountId, createdAt: { gte: last30Days } } }),
      prisma.aiReply.count({ where: { businessAccountId, createdAt: { gte: last30Days } } }),
      prisma.aiReply.count({ where: { businessAccountId, approvalStatus: 'SENT' } }),
      prisma.aiReply.count({ where: { businessAccountId, approvalStatus: 'PENDING' } }),
      prisma.status.findMany({
        where: { businessAccountId },
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: {
          contact: { select: { name: true, leadStage: true } },
          aiReplies: { select: { approvalStatus: true }, take: 1 },
        },
      }),
      prisma.status.groupBy({
        by: ['detectedEvent'],
        where: { businessAccountId, createdAt: { gte: last30Days } },
        _count: true,
      }),
      prisma.aiReply.groupBy({
        by: ['approvalStatus'],
        where: { businessAccountId },
        _count: true,
      }),
      // Last 7 days engagement - use groupBy approach instead of raw SQL
      prisma.engagementLog.findMany({
        where: {
          businessAccountId,
          createdAt: { gte: last7Days },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build engagement trend from logs
    const trendMap: Record<string, number> = {};
    recentEngagement.forEach((log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    // Fill last 7 days even if 0
    const engagementTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      engagementTrend.push({ date: dateStr, count: trendMap[dateStr] || 0 });
    }

    res.json({
      success: true,
      data: {
        overview: {
          totalContacts,
          connectedSessions,
          statusesDetected,
          aiRepliesGenerated,
          repliesSent,
          pendingApprovals,
        },
        recentStatuses,
        eventBreakdown: eventBreakdown.map((e) => ({
          event: e.detectedEvent,
          count: e._count,
        })),
        replyStatusBreakdown: replyStatusBreakdown.map((r) => ({
          status: r.approvalStatus,
          _count: r._count,
        })),
        engagementTrend,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getContactEngagement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const topContacts = await prisma.contact.findMany({
      where: { businessAccountId: req.businessAccountId },
      include: {
        _count: {
          select: {
            statuses: true,
            aiReplies: true,
            engagementLogs: true,
          },
        },
      },
      orderBy: { engagementLogs: { _count: 'desc' } },
      take: 10,
    });

    res.json({ success: true, data: topContacts });
  } catch (err) {
    next(err);
  }
};
