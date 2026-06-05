import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/auth';
import prisma from '../config/database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: JwtPayload;
  businessAccountId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, isActive: true, plan: true, planExpiresAt: true },
    });

    if (!user) throw new AppError('User not found', 401);

    // ── Inactive check (PHP admin ne disable kiya) ────────────────────────
    if (!user.isActive) {
      next(new AppError('ACCOUNT_INACTIVE', 403));
      return;
    }

    // ── Plan expiry check ─────────────────────────────────────────────────
    if (user.planExpiresAt && new Date() > new Date(user.planExpiresAt)) {
      next(new AppError('PLAN_EXPIRED', 403));
      return;
    }

    req.user = payload;
    next();
  } catch (err) {
    if ((err as { name?: string }).name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401));
    } else if ((err as { name?: string }).name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401));
    } else {
      next(err);
    }
  }
};

export const requireBusinessAccount = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const businessAccountId =
      (req.query.businessAccountId as string) ||
      req.body?.businessAccountId ||
      req.user?.businessAccountId;

    if (!businessAccountId) {
      throw new AppError('Business account ID required', 400);
    }

    const account = await prisma.businessAccount.findFirst({
      where: {
        id: businessAccountId,
        userId: req.user!.userId,
      },
    });

    if (!account) {
      throw new AppError('Business account not found or unauthorized', 403);
    }

    req.businessAccountId = businessAccountId;
    next();
  } catch (err) {
    next(err);
  }
};
