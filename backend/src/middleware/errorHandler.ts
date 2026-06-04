import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const isOperational = (err as AppError).isOperational || false;

  if (!isOperational || statusCode >= 500) {
    logger.error('Error:', { message: err.message, stack: err.stack });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: { message: 'Validation error', details: (err as unknown as { issues: unknown }).issues },
    });
    return;
  }

  // Handle Prisma unique constraint
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({
      success: false,
      error: { message: 'A record with this data already exists' },
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
