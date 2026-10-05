import type { RequestHandler } from 'express';
import { BadRequestError } from '../errors';

const MAX_DEPTH = 8;

function findUnsafeKey(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH) return '<depth-exceeded>';
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findUnsafeKey(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return key;
      }
      const hit = findUnsafeKey(child, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * NoSQL-injection / prototype-pollution guard.
 * Rejects any request whose body, query or params contain operator-style keys
 * ("$ne", "$gt", "a.b") before they reach validation or Mongoose.
 */
export const sanitizeRequest: RequestHandler = (req, _res, next) => {
  for (const [name, value] of [['body', req.body], ['query', req.query], ['params', req.params]] as const) {
    const bad = findUnsafeKey(value);
    if (bad) return next(new BadRequestError(`Disallowed key in request ${name}`, { key: bad.slice(0, 40) }));
  }
  next();
};
