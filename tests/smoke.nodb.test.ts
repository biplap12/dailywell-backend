import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { API } from './helpers';

/**
 * Database-free checks: everything here is decided before the first query,
 * so it runs without MongoDB (`npm run test:unit`).
 */
const app = createApp();

describe('request pipeline (no database)', () => {
  it('rejects unauthenticated access to every private module', async () => {
    for (const p of ['/water', '/sleep', '/habits', '/routines', '/reminders', '/steps', '/activities', '/calendar/events', '/notifications', '/sync/changes', '/admin/users', '/users/me']) {
      const res = await request(app).get(`${API}${p}`);
      expect(res.status, p).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
    }
  });

  it('validates registration before touching the database', async () => {
    const base = { name: 'John', email: 'j@example.com', phone: '9800000000', password: 'password123' };
    for (const patch of [{ name: 'J' }, { email: 'bad' }, { phone: '1' }, { password: '123' }, { role: 'SUPER_ADMIN' }]) {
      const res = await request(app).post(`${API}/auth/register`).send({ ...base, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('blocks NoSQL operator injection on login', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('blocks prototype pollution and dotted keys', async () => {
    const a = await request(app).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{"__proto__":{"x":1}}');
    expect(a.status).toBe(400);
    const b = await request(app).post(`${API}/auth/login`).send({ 'a.b': 1 });
    expect(b.status).toBe(400);
  });

  it('rejects forged / unsigned / wrong-type tokens before any lookup', async () => {
    const wrongSecret = jwt.sign({ sub: 'x', typ: 'access' }, 'another-secret-0123456789', { algorithm: 'HS256' });
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"x","typ":"access"}').toString('base64url')}.`;
    const expired = jwt.sign({ sub: 'x', role: 'USER', sid: 's', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, {
      algorithm: 'HS256', issuer: 'dailywell-api', audience: 'dailywell-clients', expiresIn: -10,
    });
    const refreshAsAccess = jwt.sign({ sub: 'x', sid: 's', jti: 'j', fam: 'f', typ: 'refresh' }, process.env.JWT_ACCESS_SECRET!, {
      algorithm: 'HS256', issuer: 'dailywell-api', audience: 'dailywell-clients', expiresIn: '5m',
    });
    for (const [name, token, code] of [
      ['garbage', 'not.a.jwt', 'INVALID_TOKEN'],
      ['wrong secret', wrongSecret, 'INVALID_TOKEN'],
      ['alg none', none, 'INVALID_TOKEN'],
      ['expired', expired, 'TOKEN_EXPIRED'],
      ['refresh as access', refreshAsAccess, 'INVALID_TOKEN'],
    ] as const) {
      const res = await request(app).get(`${API}/auth/profile`).set('Authorization', `Bearer ${token}`);
      expect(res.status, name).toBe(401);
      expect(res.body.error.code, name).toBe(code);
    }
  });

  it('safe errors: malformed JSON, oversize bodies, unknown routes', async () => {
    const bad = await request(app).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('MALFORMED_JSON');
    expect((await request(app).post(`${API}/auth/login`).send({ x: 'x'.repeat(400_000) })).status).toBe(413);
    const nf = await request(app).get(`${API}/nope`);
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(JSON.stringify(bad.body)).not.toMatch(/node_modules|\.ts:\d+/);
  });

  it('security headers, request ids and CORS allow-list', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect((await request(app).get('/health/live').set('X-Request-Id', 'client-req-12345')).headers['x-request-id']).toBe('client-req-12345');
    expect((await request(app).get('/health/live').set('Origin', 'http://localhost:3000')).headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect((await request(app).get('/health/live').set('Origin', 'https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });

  it('readiness reports unhealthy (503) when the database is not connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } });
  });
});

describe('OpenAPI generated from the real routes', () => {
  it('documents every mobile endpoint with request schemas', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    const paths = res.body.paths as Record<string, Record<string, any>>;
    const expected: Array<[string, string]> = [
      ['/auth/register', 'post'], ['/auth/login', 'post'], ['/auth/refresh', 'post'], ['/auth/logout', 'post'], ['/auth/profile', 'get'],
      ['/water', 'get'], ['/water', 'post'], ['/water/{id}', 'delete'],
      ['/sleep', 'get'], ['/sleep', 'post'], ['/sleep/{id}', 'put'], ['/sleep/{id}', 'delete'],
      ['/habits', 'get'], ['/habits', 'post'], ['/habits/{id}', 'put'], ['/habits/{id}', 'delete'], ['/habits/{id}/toggle', 'post'],
      ['/routines', 'get'], ['/routines', 'post'], ['/routines/{id}', 'put'], ['/routines/{id}', 'delete'], ['/routines/reorder', 'post'], ['/routines/{id}/complete', 'put'],
      ['/reminders', 'get'], ['/reminders', 'post'], ['/reminders/{id}', 'put'], ['/reminders/{id}', 'delete'],
      ['/steps', 'get'], ['/steps', 'post'], ['/steps/batch', 'post'], ['/users/step-goal', 'put'],
      ['/activities', 'get'], ['/activities', 'post'], ['/activities/{id}', 'delete'],
      ['/calendar/events', 'get'], ['/calendar/events', 'post'], ['/calendar/events/{id}', 'put'], ['/calendar/events/{id}', 'delete'],
      ['/config/holidays', 'get'], ['/config', 'get'],
      ['/notifications', 'get'], ['/notifications/{id}/read', 'put'], ['/notifications/{id}', 'delete'],
      ['/sync/upload', 'post'],
    ];
    for (const [p, m] of expected) expect(paths[p]?.[m], `${m.toUpperCase()} ${p}`).toBeTruthy();

    const upload = paths['/sync/upload'].post;
    expect(upload.security).toEqual([{ bearerAuth: [] }]);
    expect(upload.requestBody.content['application/json'].schema.properties.operations.maxItems).toBe(100);
    expect(paths['/water'].get.parameters.some((q: any) => q.name === 'limit' && q.schema.maximum === 100)).toBe(true);
    expect(res.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect((await request(app).get('/api/docs/')).status).toBe(200);
  });
});
