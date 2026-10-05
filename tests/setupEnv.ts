// Runs before every test file, before any application module is imported.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ??= '30d';
process.env.REDIS_URL = '';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Generous limits so functional tests never trip them; rateLimit.test.ts overrides these.
process.env.AUTH_RATE_LIMIT_MAX ??= '10000';
process.env.GENERAL_RATE_LIMIT_MAX ??= '100000';
process.env.SYNC_RATE_LIMIT_MAX ??= '10000';
