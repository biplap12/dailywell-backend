import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

/**
 * Structured access log. Deliberately logs only the path (no query string,
 * which may carry tokens) and never headers or bodies.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      duration: Math.round(durationMs * 100) / 100,
      userId: req.auth?.userId,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    }, 'request completed');
  });
  next();
};
