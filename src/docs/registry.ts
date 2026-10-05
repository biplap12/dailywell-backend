import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { validate } from '../common/middleware/validate';

export interface RouteDoc {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  /** Path relative to /api/v1, using Express style params (e.g. /water/:id) */
  path: string;
  tags: string[];
  summary: string;
  description?: string;
  auth?: boolean;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  headers?: ZodTypeAny;
  /** Zod schema describing the `data` field of the success response */
  response?: ZodTypeAny;
  successStatus?: number;
  paginated?: boolean;
  rateLimited?: boolean;
}

const registry: RouteDoc[] = [];

export function getRegisteredRoutes(): readonly RouteDoc[] {
  return registry;
}

/**
 * Registers a route for OpenAPI generation AND returns the Zod validation
 * middleware for the same schemas, so the documentation can never drift
 * from what the server actually enforces.
 */
export function doc(route: RouteDoc): RequestHandler[] {
  registry.push(route);
  return [validate({ body: route.body, query: route.query, params: route.params, headers: route.headers })];
}
