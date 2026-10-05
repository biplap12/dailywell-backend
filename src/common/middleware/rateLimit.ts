import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../../config/env';
import { sendError } from '../utils/response';

/**
 * Factory so tests and future Redis-backed stores can build their own limiters.
 * Swap `store` for rate-limit-redis when horizontally scaling.
 */
export function createLimiter(opts: Partial<Options> & { max: number; windowMs?: number; name?: string }) {
  const { name = 'default', ...rest } = opts;
  return rateLimit({
    windowMs: 60_000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      sendError(res, 429, 'Too many requests, please try again later', 'RATE_LIMITED', { limiter: name }),
    ...rest,
  });
}

/** register / login / refresh / password operations: 5 req/min/IP by default */
export const authLimiter = createLimiter({ max: env.AUTH_RATE_LIMIT_MAX, name: 'auth' });

/** Bulk sync uploads */
export const syncLimiter = createLimiter({ max: env.SYNC_RATE_LIMIT_MAX, name: 'sync' });

/** General API traffic */
export const generalLimiter = createLimiter({ max: env.GENERAL_RATE_LIMIT_MAX, name: 'general' });
