import { Router } from 'express';
import { authenticate, requireBusinessAccount, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate, requireBusinessAccount);

// GET /automation/rules
router.get('/rules', async (req: AuthRequest, res, next) => {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { businessAccountId: req.businessAccountId! },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

// POST /automation/rules
router.post('/rules', async (req: AuthRequest, res, next) => {
  try {
    const { name, eventType, template, autoSend, delayMinutes, couponCode, discountPercent, isActive } = req.body;
    if (!name || !eventType || !template) {
      res.status(400).json({ success: false, error: { message: 'name, eventType, template required' } });
      return;
    }
    const rule = await prisma.automationRule.create({
      data: {
        businessAccountId: req.businessAccountId!,
        name, eventType, template,
        autoSend: autoSend ?? false,
        delayMinutes: delayMinutes ?? 5,
        couponCode: couponCode || null,
        discountPercent: discountPercent ?? 0,
        isActive: isActive ?? true,
      },
    });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// PUT /automation/rules/:id
router.put('/rules/:id', async (req: AuthRequest, res, next) => {
  try {
    const { name, eventType, template, autoSend, delayMinutes, couponCode, discountPercent, isActive } = req.body;
    const rule = await prisma.automationRule.updateMany({
      where: { id: req.params.id, businessAccountId: req.businessAccountId! },
      data: {
        ...(name !== undefined && { name }),
        ...(eventType !== undefined && { eventType }),
        ...(template !== undefined && { template }),
        ...(autoSend !== undefined && { autoSend }),
        ...(delayMinutes !== undefined && { delayMinutes: Number(delayMinutes) }),
        ...(couponCode !== undefined && { couponCode: couponCode || null }),
        ...(discountPercent !== undefined && { discountPercent: Number(discountPercent) }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });
    if (rule.count === 0) {
      res.status(404).json({ success: false, error: { message: 'Rule not found' } });
      return;
    }
    const updated = await prisma.automationRule.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /automation/rules/:id
router.delete('/rules/:id', async (req: AuthRequest, res, next) => {
  try {
    await prisma.automationRule.deleteMany({
      where: { id: req.params.id, businessAccountId: req.businessAccountId! },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /automation/rules/sync — bulk sync from frontend localStorage
// Frontend sends its full rules array; backend replaces all rules for this account
router.post('/rules/sync', async (req: AuthRequest, res, next) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
      res.status(400).json({ success: false, error: { message: 'rules array required' } });
      return;
    }

    // Delete all existing rules, insert fresh
    await prisma.automationRule.deleteMany({ where: { businessAccountId: req.businessAccountId! } });

    if (rules.length > 0) {
      await prisma.automationRule.createMany({
        data: rules.map((r: Record<string, unknown>) => ({
          businessAccountId: req.businessAccountId!,
          name: String(r.name || ''),
          eventType: String(r.eventType || 'BIRTHDAY'),
          template: String(r.template || ''),
          autoSend: Boolean(r.autoSend),
          delayMinutes: Number(r.delayMinutes ?? 5),
          couponCode: r.couponCode ? String(r.couponCode) : null,
          discountPercent: Number(r.discountPercent ?? 0),
          isActive: r.isActive !== false,
        })),
      });
    }

    const saved = await prisma.automationRule.findMany({ where: { businessAccountId: req.businessAccountId! } });
    logger.info(`[Automation] Synced ${saved.length} rules for ${req.businessAccountId}`);
    res.json({ success: true, data: saved });
  } catch (err) { next(err); }
});

export default router;
