import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { authenticate, requireBusinessAccount } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth to ALL routes in this file
router.use(authenticate, requireBusinessAccount);

// GET /settings
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    let settings = await prisma.businessSettings.findUnique({
      where: { businessAccountId: req.businessAccountId! },
    });
    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: { businessAccountId: req.businessAccountId! },
      });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    logger.error('Settings GET error:', err);
    next(err);
  }
});

// PUT /settings
router.put('/', async (req: AuthRequest, res, next) => {
  try {
    const {
      autoReplyEnabled, approvalRequired, sendDelayMinutes,
      workingHoursEnabled, workingHoursStart, workingHoursEnd,
      maxRepliesPerDay, rateLimitEnabled, spamProtection,
      consentRequired, notifyOnDetection, notifyOnApproval,
    } = req.body;

    const settings = await prisma.businessSettings.upsert({
      where: { businessAccountId: req.businessAccountId! },
      update: {
        ...(autoReplyEnabled   !== undefined && { autoReplyEnabled }),
        ...(approvalRequired   !== undefined && { approvalRequired }),
        ...(sendDelayMinutes   !== undefined && { sendDelayMinutes: Number(sendDelayMinutes) }),
        ...(workingHoursEnabled !== undefined && { workingHoursEnabled }),
        ...(workingHoursStart  !== undefined && { workingHoursStart }),
        ...(workingHoursEnd    !== undefined && { workingHoursEnd }),
        ...(maxRepliesPerDay   !== undefined && { maxRepliesPerDay: Number(maxRepliesPerDay) }),
        ...(rateLimitEnabled   !== undefined && { rateLimitEnabled }),
        ...(spamProtection     !== undefined && { spamProtection }),
        ...(consentRequired    !== undefined && { consentRequired }),
        ...(notifyOnDetection  !== undefined && { notifyOnDetection }),
        ...(notifyOnApproval   !== undefined && { notifyOnApproval }),
      },
      create: {
        businessAccountId: req.businessAccountId!,
        ...(autoReplyEnabled !== undefined && { autoReplyEnabled }),
        ...(approvalRequired !== undefined && { approvalRequired }),
        ...(sendDelayMinutes !== undefined && { sendDelayMinutes: Number(sendDelayMinutes) }),
      },
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    logger.error('Settings PUT error:', err);
    next(err);
  }
});

export default router;
