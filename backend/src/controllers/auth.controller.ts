import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { hashPassword, comparePassword, signToken } from '../utils/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const signupSchema = z.object({
  name: z.string().min(2, 'Name min 2 chars').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password min 8 chars').max(100),
  businessName: z.string().min(2, 'Business name min 2 chars').max(200),
  industry: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Signup attempt:', { email: req.body?.email });

    const data = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        businessAccounts: {
          create: {
            name: data.businessName,
            industry: data.industry,
            phone: data.phone,
          },
        },
      },
      include: { businessAccounts: true },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessAccountId: user.businessAccounts[0]?.id,
    });

    logger.info('✅ Signup success:', { email: user.email, id: user.id });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email },
        businessAccount: user.businessAccounts[0],
        businessAccounts: user.businessAccounts,
      },
    });
  } catch (err) {
    logger.error('❌ Signup error:', err);
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info('Login attempt:', { email: req.body?.email });

    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { businessAccounts: { take: 5 } },
    });

    if (!user) throw new AppError('Invalid email or password', 401);

    const validPassword = await comparePassword(data.password, user.password);
    if (!validPassword) throw new AppError('Invalid email or password', 401);

    // Check if account is active (PHP admin may have deactivated)
    if ((user as typeof user & { isActive?: boolean }).isActive === false) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403);
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessAccountId: user.businessAccounts[0]?.id,
    });

    logger.info('✅ Login success:', { email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email },
        businessAccounts: user.businessAccounts,
      },
    });
  } catch (err) {
    logger.error('❌ Login error:', err);
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { businessAccounts: true },
    });
    if (!user) throw new AppError('User not found', 404);
    const { password: _pw, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  } catch (err) { next(err); }
};

export const createBusinessAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({ name: z.string().min(2), industry: z.string().optional(), phone: z.string().optional() });
    const data = schema.parse(req.body);
    const account = await prisma.businessAccount.create({
      data: {
        name: data.name,
        industry: data.industry,
        phone: data.phone,
        user: {
          connect: {
            id: req.user!.userId
          }
        }
      }
    });
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
};
