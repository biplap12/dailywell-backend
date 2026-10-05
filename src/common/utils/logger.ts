import pino from 'pino';

const level = process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never log credentials or tokens, even if they end up in a logged object.
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
      'accessToken',
      'refreshToken',
      '*.accessToken',
      '*.refreshToken',
      'req.headers.authorization',
      'headers.authorization',
      'authorization',
    ],
    censor: '[REDACTED]',
  },
});
