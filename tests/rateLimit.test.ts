import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Must be set before the app (and therefore env.ts) is first imported in this file.
process.env.AUTH_RATE_LIMIT_MAX = '5';

import { API, buildApp, connectTestDb, disconnectTestDb } from './helpers';

let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  vi.resetModules();
  await connectTestDb();
  app = await buildApp();
});
afterAll(disconnectTestDb);

describe('rate limiting', () => {
  it('limits auth endpoints to 5 requests per minute per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post(`${API}/auth/login`).send({ email: 'a@example.com', password: 'whatever1' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);

    const limited = await request(app).post(`${API}/auth/register`).send({});
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
    expect(limited.headers['ratelimit-limit']).toBe('5');
  });

  it('does not limit unrelated endpoints', async () => {
    expect((await request(app).get('/health/live')).status).toBe(200);
    expect((await request(app).get(`${API}/config`)).status).toBe(200);
  });
});
