import type { RequestHandler } from 'express';
import { v4 as uuid } from 'uuid';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : uuid();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
