import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.info(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError(err) {
    logger.error('Redis reconnect error:', err);
    return true;
  },
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('❌ Redis error:', err));
redis.on('close', () => logger.warn('⚠️ Redis connection closed'));

export const redisConnection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
  password: new URL(REDIS_URL).password || undefined,
};

export default redis;
