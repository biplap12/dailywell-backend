import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '../errors';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
}

function formatIssues(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    const details: Record<string, unknown> = {};

    if (schemas.headers) {
      const r = schemas.headers.safeParse(req.headers);
      if (!r.success) details.headers = formatIssues(r.error);
    }
    if (schemas.params) {
      const r = schemas.params.safeParse(req.params);
      if (r.success) req.params = r.data;
      else details.params = formatIssues(r.error);
    }
    if (schemas.query) {
      const r = schemas.query.safeParse(req.query);
      if (r.success) req.query = r.data;
      else details.query = formatIssues(r.error);
    }
    if (schemas.body) {
      const r = schemas.body.safeParse(req.body ?? {});
      if (r.success) req.body = r.data;
      else details.body = formatIssues(r.error);
    }

    if (Object.keys(details).length > 0) return next(new ValidationError('Validation failed', details));
    next();
  };
}
