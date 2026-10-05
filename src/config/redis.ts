import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../common/utils/logger';

let client: Redis | null = null;

/**
 * Redis is optional. When REDIS_URL is empty the API runs without it.
 * Intended future uses: caching, distributed rate limiting, sessions,
 * background jobs and distributed locks.
 */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
    client.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  if (!r) {
    logger.info('Redis not configured; running without it');
    return;
  }
  try {
    await r.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Redis unavailable; continuing without it');
  }
}

export async function isRedisHealthy(): Promise<'healthy' | 'unhealthy' | 'disabled'> {
  const r = getRedis();
  if (!r) return 'disabled';
  try {
    return (await r.ping()) === 'PONG' ? 'healthy' : 'unhealthy';
  } catch {
    return 'unhealthy';
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
