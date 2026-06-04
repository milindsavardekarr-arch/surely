import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

prisma.$on('error' as never, (e: unknown) => {
  logger.error('Prisma error:', e);
});

prisma.$on('warn' as never, (e: unknown) => {
  logger.warn('Prisma warning:', e);
});

export default prisma;
