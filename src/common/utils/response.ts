import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message = 'Operation successful', status = 200): Response {
  return res.status(status).json({ success: true, message, data });
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

export function sendError(res: Response, status: number, message: string, code: string, details?: unknown): Response {
  return res.status(status).json({
    success: false,
    message,
    error: { code, details: details ?? {} },
  });
}
