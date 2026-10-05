import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, buildApp, connectTestDb, disconnectTestDb, registerUser } from './helpers';

let app: Express;
beforeAll(async () => {
  await connectTestDb();
  app = await buildApp();
});
afterAll(disconnectTestDb);

const valid = { name: 'John Doe', email: 'John@Example.com', phone: '9800000000', password: 'password123' };

describe('registration', () => {
  it('registers a user, normalizes the email and never returns secrets', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('john@example.com');
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('argon2');
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    const res = await request(app).post(`${API}/auth/register`).send({ ...valid, email: 'JOHN@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['short name', { name: 'J' }],
    ['bad email', { email: 'not-an-email' }],
    ['short phone', { phone: '123' }],
    ['short password', { password: '12345' }],
  ])('validates input: %s', async (_label, patch) => {
    const res = await request(app).post(`${API}/auth/register`).send({ ...valid, email: 'v@example.com', ...patch });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot self-assign a role (mass assignment)', async () => {
    const res = await request(app).post(`${API}/auth/register`).send({ ...valid, email: 'evil@example.com', role: 'SUPER_ADMIN' });
    expect(res.status).toBe(422); // unknown keys are rejected outright
  });
});

describe('login', () => {
  it('logs in and returns tokens and profile', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'john@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.lastLoginAt).toBeTruthy();
  });

  it('rejects a wrong password and an unknown email with the same generic error', async () => {
    const bad = await request(app).post(`${API}/auth/login`).send({ email: 'john@example.com', password: 'wrongpass' });
    const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'nobody@example.com', password: 'wrongpass' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('token lifecycle', () => {
  it('rotates refresh tokens and detects reuse', async () => {
    const u = await registerUser(app);

    const r1 = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: u.refreshToken });
    expect(r1.status).toBe(200);
    const next = r1.body.data.refreshToken as string;
    expect(next).not.toBe(u.refreshToken);

    // Replaying the already-used token is treated as theft...
    const replay = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: u.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');

    // ...and burns the whole family, including the legitimately rotated token.
    const afterBurn = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: next });
    expect(afterBurn.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const u = await registerUser(app);
    const out = await request(app).post(`${API}/auth/logout`).send({ refreshToken: u.refreshToken });
    expect(out.status).toBe(200);
    const res = await request(app).post(`${API}/auth/refresh`).send({ refreshToken: u.refreshToken });
    expect(res.status).toBe(401);
  });

  it('rejects an expired access token with TOKEN_EXPIRED', async () => {
    const u = await registerUser(app);
    const expired = jwt.sign({ sub: u.id, role: 'USER', sid: 'x', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, {
      algorithm: 'HS256',
      expiresIn: -10,
      issuer: 'dailywell-api',
      audience: 'dailywell-clients',
    });
    const res = await request(app).get(`${API}/auth/profile`).set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('does not accept a refresh token as an access token', async () => {
    const u = await registerUser(app);
    const res = await request(app).get(`${API}/auth/profile`).set('Authorization', `Bearer ${u.refreshToken}`);
    expect(res.status).toBe(401);
  });

  it('returns the profile for a valid token and 401 without one', async () => {
    const u = await registerUser(app);
    const ok = await request(app).get(`${API}/auth/profile`).set(u.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(u.id);
    const none = await request(app).get(`${API}/auth/profile`);
    expect(none.status).toBe(401);
  });
});
