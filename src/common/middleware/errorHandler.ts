import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../errors';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { env } from '../../config/env';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl.split('?')[0]} not found`, 'ROUTE_NOT_FOUND');
};

function isMongoDuplicate(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.isOperational ? err.message : 'Something went wrong';
    details = err.isOperational ? err.details : undefined;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed identifier or value';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (isMongoDuplicate(err)) {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with these unique values already exists';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains malformed JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (status >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.originalUrl.split('?')[0] }, 'Unhandled error');
  }

  const body: Record<string, unknown> = {
    success: false,
    message,
    error: { code, details: details ?? {} },
    requestId: req.requestId,
  };
  if (!env.isProd && status >= 500 && err instanceof Error) {
    (body.error as Record<string, unknown>).debug = { name: err.name, message: err.message, stack: err.stack };
  }
  res.status(status).json(body);
};
