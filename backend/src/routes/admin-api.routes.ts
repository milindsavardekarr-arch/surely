/**
 * Admin API Routes — For PHP Admin Panel Integration
 *
 * These routes allow the PHP admin to:
 * 1. Create a new company (BusinessAccount) + user
 * 2. List all users
 * 3. Get user details
 * 4. Activate / Deactivate a user
 * 5. Delete a user
 *
 * Security: Protected by ADMIN_API_KEY env variable
 * PHP sends: Authorization: Bearer <ADMIN_API_KEY>
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { hashPassword } from '../utils/auth';
import { logger } from '../utils/logger';

const router = Router();

// ── Admin API Key Auth ────────────────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.ADMIN_API_KEY || '';
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'ADMIN_API_KEY not configured on server' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const providedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!providedKey || providedKey !== apiKey) {
    res.status(401).json({ success: false, error: 'Invalid or missing API key' });
    return;
  }
  next();
}

router.use(adminAuth);

// ── POST /admin-api/users — Create company + user ────────────────────────────
// PHP sends: { name, email, password, companyName, industry, phone, phpUserId }
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name:        z.string().min(2, 'Name required'),
      email:       z.string().email('Valid email required'),
      password:    z.string().min(6, 'Password min 6 chars'),
      companyName: z.string().min(2, 'Company name required'),
      industry:    z.string().optional(),
      phone:       z.string().optional(),
      phpUserId:   z.string().optional(), // PHP admin's user ID for reference
    });

    const data = schema.parse(req.body);

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered: ' + data.email });
      return;
    }

    const hashed = await hashPassword(data.password);

    // Create user + company in one transaction
    const user = await prisma.user.create({
      data: {
        name:        data.name,
        email:       data.email,
        password:    hashed,
        isActive:    true,
        onboardedBy: 'php_admin',
        phpUserId:   data.phpUserId || null,
        businessAccounts: {
          create: {
            name:     data.companyName,
            industry: data.industry || null,
            phone:    data.phone    || null,
          },
        },
      },
      include: { businessAccounts: true },
    });

    logger.info('[AdminAPI] Created user: ' + user.email + ' | company: ' + data.companyName);

    res.status(201).json({
      success: true,
      message: 'User and company created successfully',
      data: {
        user: {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          isActive:  user.isActive,
          createdAt: user.createdAt,
        },
        company: {
          id:       user.businessAccounts[0]?.id,
          name:     user.businessAccounts[0]?.name,
          industry: user.businessAccounts[0]?.industry,
          phone:    user.businessAccounts[0]?.phone,
        },
        dashboardUrl: (process.env.FRONTEND_URL || 'http://localhost:3000') + '/auth/login',
      },
    });
  } catch (err) {
    if ((err as {name?: string}).name === 'ZodError') {
      res.status(400).json({ success: false, error: (err as {errors?: unknown[]}).errors });
      return;
    }
    logger.error('[AdminAPI] Create user error:', err);
    next(err);
  }
});

// ── GET /admin-api/users — List all users ────────────────────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(req.query.page  as string || '1');
    const limit = parseInt(req.query.limit as string || '50');

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, email: true, isActive: true,
          onboardedBy: true, phpUserId: true, createdAt: true,
          businessAccounts: {
            select: { id: true, name: true, industry: true, phone: true, createdAt: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: { users, total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ── GET /admin-api/users/:id — Get single user ───────────────────────────────
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, isActive: true,
        onboardedBy: true, phpUserId: true, createdAt: true,
        businessAccounts: {
          select: {
            id: true, name: true, industry: true, phone: true, createdAt: true,
            _count: { select: { contacts: true, statuses: true, aiReplies: true } },
          },
        },
      },
    });

    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PATCH /admin-api/users/:id/status — Activate/Deactivate ─────────────────
router.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data:  { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });
    logger.info('[AdminAPI] User ' + (isActive ? 'activated' : 'deactivated') + ': ' + user.email);
    res.json({ success: true, message: 'User ' + (isActive ? 'activated' : 'deactivated'), data: user });
  } catch (err) { next(err); }
});

// ── DELETE /admin-api/users/:id — Delete user ────────────────────────────────
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    await prisma.user.delete({ where: { id: req.params.id } });
    logger.info('[AdminAPI] Deleted user: ' + user.email);
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) { next(err); }
});

// ── GET /admin-api/stats — Dashboard stats ───────────────────────────────────
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, activeUsers, totalCompanies] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.businessAccount.count(),
    ]);
    res.json({ success: true, data: { totalUsers, activeUsers, inactiveUsers: totalUsers - activeUsers, totalCompanies } });
  } catch (err) { next(err); }
});

export default router;
