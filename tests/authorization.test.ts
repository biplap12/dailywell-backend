import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, buildApp, connectTestDb, disconnectTestDb, registerGuest, registerUser, registerWithRole, waterBody } from './helpers';

let app: Express;
beforeAll(async () => {
  await connectTestDb();
  app = await buildApp();
});
afterAll(disconnectTestDb);

describe('authentication required', () => {
  it.each(['/water', '/sleep', '/habits', '/routines', '/reminders', '/steps', '/activities', '/calendar/events', '/notifications'])(
    'GET %s without a token -> 401',
    async (path) => {
      const res = await request(app).get(`${API}${path}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    },
  );
});

describe('IDOR protection', () => {
  it("user B cannot read, update or delete user A's records (404, not 403)", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);

    const created = await request(app).post(`${API}/water`).set(a.auth).send(waterBody());
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect((await request(app).get(`${API}/water/${id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).delete(`${API}/water/${id}`).set(b.auth)).status).toBe(404);

    // Still intact for the owner.
    expect((await request(app).get(`${API}/water/${id}`).set(a.auth)).status).toBe(200);

    const sleep = await request(app).post(`${API}/habits`).set(a.auth).send({ name: 'Read' });
    const hid = sleep.body.data.id;
    expect((await request(app).put(`${API}/habits/${hid}`).set(b.auth).send({ name: 'Hacked' })).status).toBe(404);
    expect((await request(app).post(`${API}/habits/${hid}/toggle`).set(b.auth).send({})).status).toBe(404);
  });

  it('lists never include other users\' data', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await request(app).post(`${API}/water`).set(a.auth).send(waterBody());
    const res = await request(app).get(`${API}/water`).set(b.auth);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('ignores a userId supplied in the body', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const res = await request(app).post(`${API}/water`).set(a.auth).send(waterBody({ userId: b.id }));
    expect(res.status).toBe(422); // unknown key rejected
  });
});

describe('RBAC', () => {
  it('regular users cannot reach admin routes', async () => {
    const u = await registerUser(app);
    expect((await request(app).get(`${API}/admin/users`).set(u.auth)).status).toBe(403);
    expect((await request(app).get(`${API}/admin/audit-logs`).set(u.auth)).status).toBe(403);
    expect((await request(app).put(`${API}/config`).set(u.auth).send({ maintenanceMode: true })).status).toBe(403);
  });

  it('admins can list users but not change roles; super admins can', async () => {
    const admin = await registerWithRole(app, 'ADMIN');
    const root = await registerWithRole(app, 'SUPER_ADMIN');
    const target = await registerUser(app);

    expect((await request(app).get(`${API}/admin/users`).set(admin.auth)).status).toBe(200);
    expect((await request(app).put(`${API}/admin/users/${target.id}/role`).set(admin.auth).send({ role: 'ADMIN' })).status).toBe(403);
    const promoted = await request(app).put(`${API}/admin/users/${target.id}/role`).set(root.auth).send({ role: 'ADMIN' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.role).toBe('ADMIN');
  });

  it('admins cannot suspend an equal or higher rank, and cannot suspend themselves', async () => {
    const admin = await registerWithRole(app, 'ADMIN');
    const admin2 = await registerWithRole(app, 'ADMIN');
    expect((await request(app).put(`${API}/admin/users/${admin2.id}/suspension`).set(admin.auth).send({ isSuspended: true })).status).toBe(403);
    expect((await request(app).put(`${API}/admin/users/${admin.id}/suspension`).set(admin.auth).send({ isSuspended: true })).status).toBe(403);
  });

  it('suspension takes effect immediately and revokes sessions', async () => {
    const admin = await registerWithRole(app, 'ADMIN');
    const target = await registerUser(app);
    expect((await request(app).get(`${API}/auth/profile`).set(target.auth)).status).toBe(200);

    const res = await request(app).put(`${API}/admin/users/${target.id}/suspension`).set(admin.auth).send({ isSuspended: true });
    expect(res.status).toBe(200);

    expect((await request(app).get(`${API}/auth/profile`).set(target.auth)).status).toBe(403);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refreshToken: target.refreshToken })).status).toBeGreaterThanOrEqual(401);
  });

  it('guests have restricted access: own data yes, bulk sync no', async () => {
    const g = await registerGuest(app);
    expect((await request(app).post(`${API}/water`).set(g.auth).send(waterBody())).status).toBe(201);
    const sync = await request(app).post(`${API}/sync/upload`).set(g.auth).send({ deviceId: 'd1', operations: [] });
    expect(sync.status).toBe(403);
    expect((await request(app).get(`${API}/admin/users`).set(g.auth)).status).toBe(403);
  });

  it('public config and holidays need no token', async () => {
    const cfg = await request(app).get(`${API}/config`);
    expect(cfg.status).toBe(200);
    expect(cfg.body.data).toMatchObject({ maintenanceMode: false, registrationEnabled: true, minimumAppVersion: '1.0.0' });
    expect((await request(app).get(`${API}/config/holidays`)).status).toBe(200);
  });
});
