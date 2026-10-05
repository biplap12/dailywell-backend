import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, buildApp, connectTestDb, disconnectTestDb, registerUser, waterBody, type TestUser } from './helpers';

let app: Express;
let u: TestUser;
beforeAll(async () => {
  await connectTestDb();
  app = await buildApp();
  u = await registerUser(app);
});
afterAll(disconnectTestDb);

describe('NoSQL injection', () => {
  it('login rejects operator objects instead of matching any user', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects $-operators and dotted keys in bodies and queries', async () => {
    const body = await request(app).post(`${API}/water`).set(u.auth).send({ ...waterBody(), amountMl: { $gt: 0 } });
    expect(body.status).toBe(400);
    const q = await request(app).get(`${API}/water?date[$ne]=x`).set(u.auth);
    expect([400, 422]).toContain(q.status);
    const dotted = await request(app).post(`${API}/water`).set(u.auth).send({ 'a.b': 1 });
    expect(dotted.status).toBe(400);
  });

  it('rejects prototype pollution attempts', async () => {
    const res = await request(app).post(`${API}/water`).set(u.auth).set('Content-Type', 'application/json').send('{"__proto__":{"isAdmin":true}}');
    expect(res.status).toBe(400);
  });
});

describe('JWT hardening', () => {
  it.each([
    ['garbage', 'not.a.jwt'],
    ['wrong secret', jwt.sign({ sub: 'x', typ: 'access' }, 'some-other-secret-0123456789', { algorithm: 'HS256' })],
    ['alg none', `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"x","typ":"access"}').toString('base64url')}.`],
  ])('rejects %s tokens', async (_n, token) => {
    const res = await request(app).get(`${API}/auth/profile`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a validly signed token for a user that does not exist', async () => {
    const t = jwt.sign({ sub: '64b7f0f0f0f0f0f0f0f0f0f0', role: 'SUPER_ADMIN', sid: 's', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, {
      algorithm: 'HS256', issuer: 'dailywell-api', audience: 'dailywell-clients', expiresIn: '5m',
    });
    expect((await request(app).get(`${API}/admin/users`).set('Authorization', `Bearer ${t}`)).status).toBe(401);
  });

  it('does not trust the role claim inside the token', async () => {
    const forged = jwt.sign({ sub: u.id, role: 'SUPER_ADMIN', sid: 's', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, {
      algorithm: 'HS256', issuer: 'dailywell-api', audience: 'dailywell-clients', expiresIn: '5m',
    });
    expect((await request(app).get(`${API}/admin/users`).set('Authorization', `Bearer ${forged}`)).status).toBe(403);
  });

  it('rejects malformed Authorization headers', async () => {
    expect((await request(app).get(`${API}/auth/profile`).set('Authorization', u.accessToken)).status).toBe(401);
    expect((await request(app).get(`${API}/auth/profile`).set('Authorization', 'Basic abc')).status).toBe(401);
  });
});

describe('malformed requests', () => {
  it('returns a safe 400 for malformed JSON', async () => {
    const res = await request(app).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js)/); // no stack trace
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app).post(`${API}/water`).set(u.auth).send({ notes: 'x'.repeat(400_000) });
    expect(res.status).toBe(413);
  });

  it('rejects wrong types, strings in numeric fields and unknown keys', async () => {
    expect((await request(app).post(`${API}/water`).set(u.auth).send(waterBody({ amountMl: '250' }))).status).toBe(422);
    expect((await request(app).post(`${API}/water`).set(u.auth).send(waterBody({ extra: 1 }))).status).toBe(422);
    expect((await request(app).get(`${API}/water?page=abc`).set(u.auth)).status).toBe(422);
    expect((await request(app).get(`${API}/water?sort=passwordHash`).set(u.auth)).status).toBe(422);
    expect((await request(app).get(`${API}/water/${'z'.repeat(24)}`).set(u.auth)).status).toBe(422);
  });

  it('returns the standard envelope for unknown routes', async () => {
    const res = await request(app).get(`${API}/nope`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'ROUTE_NOT_FOUND' } });
  });
});

describe('headers and request ids', () => {
  it('sets security headers, hides the framework and issues a request id', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a safe client request id and replaces an unsafe one', async () => {
    const ok = await request(app).get('/health/live').set('X-Request-Id', 'client-req-12345');
    expect(ok.headers['x-request-id']).toBe('client-req-12345');
    const bad = await request(app).get('/health/live').set('X-Request-Id', 'x y<script>');
    expect(bad.headers['x-request-id']).not.toContain('<');
  });

  it('applies a strict CORS allow-list', async () => {
    const allowed = await request(app).get('/health/live').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const denied = await request(app).get('/health/live').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('error responses carry the request id and never leak internals', async () => {
    const res = await request(app).get(`${API}/auth/profile`);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|mongodb|secret/i);
  });
});

describe('no secret leakage', () => {
  it('never returns password hashes or token hashes from any user-facing endpoint', async () => {
    const profile = await request(app).get(`${API}/auth/profile`).set(u.auth);
    const me = await request(app).get(`${API}/users/me`).set(u.auth);
    const login = await request(app).post(`${API}/auth/login`).send({ email: u.email, password: u.password });
    for (const r of [profile, me, login]) {
      const raw = JSON.stringify(r.body);
      expect(raw).not.toMatch(/passwordHash|tokenHash|argon2/);
    }
  });

  it('users cannot change their own role or email through settings', async () => {
    expect((await request(app).put(`${API}/users/settings`).set(u.auth).send({ role: 'SUPER_ADMIN' })).status).toBe(422);
    expect((await request(app).put(`${API}/users/settings`).set(u.auth).send({ email: 'x@y.com' })).status).toBe(422);
    const ok = await request(app).put(`${API}/users/settings`).set(u.auth).send({ waterGoalMl: 3000 });
    expect(ok.body.data.waterGoalMl).toBe(3000);
  });
});

describe('health and docs', () => {
  it('reports healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ api: 'healthy', database: 'healthy' });
    expect((await request(app).get('/health/live')).status).toBe(200);
    expect((await request(app).get('/health/ready')).status).toBe(200);
  });

  it('serves OpenAPI generated from the real routes', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    for (const p of ['/auth/login', '/water/{id}', '/sync/upload', '/steps/batch', '/calendar/events', '/config/holidays']) {
      expect(res.body.paths[p], p).toBeTruthy();
    }
    expect(res.body.paths['/sync/upload'].post.requestBody.content['application/json'].schema.properties.operations).toBeTruthy();
    expect((await request(app).get('/api/docs/')).status).toBe(200);
  });
});
