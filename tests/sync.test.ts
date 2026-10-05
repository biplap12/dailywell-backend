import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, buildApp, connectTestDb, disconnectTestDb, registerGuest, registerUser, today, type TestUser } from './helpers';

let app: Express;
let u: TestUser;
beforeAll(async () => {
  await connectTestDb();
  app = await buildApp();
  u = await registerUser(app);
});
afterAll(disconnectTestDb);

// The API requires idempotency keys of at least 8 characters; keep test keys readable but valid.
const padKey = (k: string) => (k.length >= 8 ? k : `test-${k}`);
const upload = (user: TestUser, deviceId: string, operations: unknown[], extra: object = {}) =>
  request(app)
    .post(`${API}/sync/upload`)
    .set(user.auth)
    .send({ deviceId, operations: operations.map((o) => ({ ...(o as object), idempotencyKey: padKey((o as { idempotencyKey: string }).idempotencyKey) })), ...extra });
const uploadRaw = (user: TestUser, body: object) => request(app).post(`${API}/sync/upload`).set(user.auth).send(body);

const create = (key: string, localId: string, payload: object = { amountMl: 250, date: today(), time: '08:30' }, entityType = 'water') => ({
  entityType, operation: 'CREATE', localId, idempotencyKey: key, payload,
});

describe('create', () => {
  it('creates and maps local ids to server ids', async () => {
    const res = await upload(u, 'android-1', [create('key-create-1', 'local-123')]);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Synchronization completed');
    expect(res.body.data).toMatchObject({ processed: 1, failed: 0, conflicts: 0 });
    expect(res.body.data.idMappings).toHaveLength(1);
    expect(res.body.data.idMappings[0]).toMatchObject({ entityType: 'water', localId: 'local-123' });
    expect(res.body.data.changes[0]).toMatchObject({ operation: 'CREATE', version: 1 });

    const serverId = res.body.data.idMappings[0].serverId;
    const got = await request(app).get(`${API}/water/${serverId}`).set(u.auth);
    expect(got.body.data).toMatchObject({ localId: 'local-123', deviceId: 'android-1', amountMl: 250 });
  });

  it('processes a mixed batch and keeps going after one failure', async () => {
    const res = await upload(u, 'android-1', [
      create('batch-1', 'b-1'),
      create('batch-bad', 'b-bad', { amountMl: -5, date: today(), time: '08:30' }),
      create('batch-2', 'b-2', { name: 'Stretch', }, 'habit'),
    ]);
    expect(res.body.data).toMatchObject({ processed: 2, failed: 1 });
    const bad = res.body.data.results.find((r: any) => r.idempotencyKey === 'batch-bad');
    expect(bad).toMatchObject({ status: 'FAILED', error: { code: 'VALIDATION_ERROR' } });
  });

  it('lets later operations reference habits created earlier in the same batch', async () => {
    const res = await upload(u, 'android-1', [
      create('hc-habit', 'h-local', { name: 'Journal' }, 'habit'),
      create('hc-done', 'c-local', { habitId: 'h-local', date: today(), isCompleted: true }, 'habit_completion'),
    ]);
    expect(res.body.data).toMatchObject({ processed: 2, failed: 0 });
    const habitId = res.body.data.idMappings.find((m: any) => m.entityType === 'habit').serverId;
    const habits = await request(app).get(`${API}/habits?date=${today()}`).set(u.auth);
    const h = habits.body.data.items.find((x: any) => x.id === habitId);
    expect(h.isCompletedOnDate).toBe(true);
    expect(h.streakCount).toBe(1);
  });
});

describe('idempotency and retries', () => {
  it('replaying the same key returns the original result and creates nothing new', async () => {
    const op = create('idem-1', 'idem-local', { amountMl: 111, date: '2022-02-02', time: '10:00' });
    const first = await upload(u, 'android-1', [op]);
    const second = await upload(u, 'android-1', [op]);

    expect(second.body.data.results[0]).toMatchObject({ status: 'DUPLICATE', replayed: true });
    expect(second.body.data.idMappings[0].serverId).toBe(first.body.data.idMappings[0].serverId);

    const list = await request(app).get(`${API}/water?date=2022-02-02`).set(u.auth);
    expect(list.body.data.items).toHaveLength(1);
  });

  it('a new key for the same device+localId still cannot duplicate the row', async () => {
    const payload = { amountMl: 222, date: '2022-03-03', time: '10:00' };
    await upload(u, 'android-1', [create('dup-a', 'same-local', payload)]);
    const again = await upload(u, 'android-1', [create('dup-b', 'same-local', payload)]);
    expect(again.body.data.results[0].status).toBe('DUPLICATE');
    expect((await request(app).get(`${API}/water?date=2022-03-03`).set(u.auth)).body.data.items).toHaveLength(1);
  });

  it('concurrent retries of one operation execute it exactly once', async () => {
    const op = create('race-1', 'race-local', { amountMl: 333, date: '2022-04-04', time: '10:00' });
    await Promise.all([upload(u, 'android-1', [op]), upload(u, 'android-1', [op]), upload(u, 'android-1', [op])]);
    expect((await request(app).get(`${API}/water?date=2022-04-04`).set(u.auth)).body.data.items).toHaveLength(1);
  });

  it('idempotency keys are scoped per user', async () => {
    const other = await registerUser(app);
    const op = create('shared-key-1', 'x-1', { amountMl: 100, date: '2022-05-05', time: '10:00' });
    expect((await upload(u, 'android-1', [op])).body.data.results[0].status).toBe('PROCESSED');
    expect((await upload(other, 'android-9', [op])).body.data.results[0].status).toBe('PROCESSED');
  });
});

describe('update and delete', () => {
  it('updates by localId, increments the version, then deletes with a tombstone', async () => {
    await upload(u, 'android-1', [create('ud-1', 'ud-local', { amountMl: 100, date: '2022-06-06', time: '10:00' })]);

    const upd = await upload(u, 'android-1', [
      { entityType: 'water', operation: 'UPDATE', localId: 'ud-local', idempotencyKey: 'ud-2', baseVersion: 1, payload: { amountMl: 150 } },
    ]);
    expect(upd.body.data).toMatchObject({ processed: 1, conflicts: 0 });
    expect(upd.body.data.changes[0]).toMatchObject({ operation: 'UPDATE', version: 2 });

    const del = await upload(u, 'android-1', [
      { entityType: 'water', operation: 'DELETE', localId: 'ud-local', idempotencyKey: 'ud-3', baseVersion: 2 },
    ]);
    expect(del.body.data.changes[0]).toMatchObject({ operation: 'DELETE', version: 3 });
    expect(del.body.data.changes[0].deletedAt).toBeTruthy();
    expect((await request(app).get(`${API}/water?date=2022-06-06`).set(u.auth)).body.data.items).toHaveLength(0);

    // Deleting again with a fresh key is still a success.
    const again = await upload(u, 'android-1', [{ entityType: 'water', operation: 'DELETE', localId: 'ud-local', idempotencyKey: 'ud-4' }]);
    expect(again.body.data).toMatchObject({ processed: 1, failed: 0 });
  });

  it('reports an update to a missing entity as a failed operation', async () => {
    const res = await upload(u, 'android-1', [
      { entityType: 'water', operation: 'UPDATE', entityId: '64b7f0f0f0f0f0f0f0f0f0f0', idempotencyKey: 'missing-1', payload: { amountMl: 1 } },
    ]);
    expect(res.body.data.results[0]).toMatchObject({ status: 'FAILED', error: { code: 'NOT_FOUND' } });
  });
});

describe('conflicts', () => {
  async function seed(key: string, local: string, date: string) {
    const r = await upload(u, 'android-A', [create(key, local, { amountMl: 100, date, time: '10:00' })]);
    return r.body.data.idMappings[0].serverId as string;
  }

  it('version mismatch with LAST_WRITE_WINS: older client edit loses and is reported, nothing is overwritten', async () => {
    const id = await seed('cf-1', 'cf-local-1', '2023-01-01');
    // Device B edits first.
    await upload(u, 'android-B', [{ entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-1b', baseVersion: 1, payload: { amountMl: 400 } }]);

    // Device A, still on version 1, edited earlier than B's write.
    const res = await upload(u, 'android-A', [
      { entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-1a', baseVersion: 1, clientUpdatedAt: '2000-01-01T00:00:00.000Z', payload: { amountMl: 999 } },
    ]);
    expect(res.body.data.conflicts).toBe(1);
    const c = res.body.data.conflictDetails[0];
    expect(c).toMatchObject({ entityType: 'water', entityId: id, clientVersion: 1, serverVersion: 2, resolution: 'SERVER_WINS', strategy: 'LAST_WRITE_WINS' });
    expect(c.clientData.amountMl).toBe(999);
    expect(c.serverData.amountMl).toBe(400);
    expect((await request(app).get(`${API}/water/${id}`).set(u.auth)).body.data.amountMl).toBe(400);
  });

  it('a newer client edit wins under LAST_WRITE_WINS but the conflict is still reported', async () => {
    const id = await seed('cf-2', 'cf-local-2', '2023-02-02');
    await upload(u, 'android-B', [{ entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-2b', baseVersion: 1, payload: { amountMl: 400 } }]);

    const res = await upload(u, 'android-A', [
      { entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-2a', baseVersion: 1, clientUpdatedAt: new Date(Date.now() + 60_000).toISOString(), payload: { amountMl: 777 } },
    ]);
    expect(res.body.data.conflicts).toBe(1);
    expect(res.body.data.conflictDetails[0].resolution).toBe('CLIENT_WINS');
    const after = await request(app).get(`${API}/water/${id}`).set(u.auth);
    expect(after.body.data).toMatchObject({ amountMl: 777, version: 3 });
  });

  it('the conflict strategy is pluggable per request', async () => {
    const id = await seed('cf-3', 'cf-local-3', '2023-03-03');
    await upload(u, 'android-B', [{ entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-3b', baseVersion: 1, payload: { amountMl: 400 } }]);
    const res = await upload(
      u, 'android-A',
      [{ entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-3a', baseVersion: 1, payload: { amountMl: 555 } }],
      { conflictStrategy: 'CLIENT_WINS' },
    );
    expect(res.body.data.conflictDetails[0]).toMatchObject({ resolution: 'CLIENT_WINS', strategy: 'CLIENT_WINS' });
    expect((await request(app).get(`${API}/water/${id}`).set(u.auth)).body.data.amountMl).toBe(555);
  });

  it('an update never resurrects a row that was deleted elsewhere', async () => {
    const id = await seed('cf-4', 'cf-local-4', '2023-04-04');
    await upload(u, 'android-B', [{ entityType: 'water', operation: 'DELETE', entityId: id, idempotencyKey: 'cf-4b' }]);
    const res = await upload(u, 'android-A', [{ entityType: 'water', operation: 'UPDATE', entityId: id, idempotencyKey: 'cf-4a', payload: { amountMl: 5 } }]);
    expect(res.body.data.conflicts).toBe(1);
    expect(res.body.data.conflictDetails[0].resolution).toBe('SERVER_WINS');
    expect((await request(app).get(`${API}/water/${id}`).set(u.auth)).status).toBe(404);
  });

  it('step records collapse onto the existing day instead of failing', async () => {
    await upload(u, 'android-A', [create('st-1', 'st-l-1', { date: '2023-05-05', steps: 100 }, 'steps')]);
    const res = await upload(u, 'android-B', [create('st-2', 'st-l-2', { date: '2023-05-05', steps: 900 }, 'steps')]);
    expect(res.body.data.failed).toBe(0);
    const list = await request(app).get(`${API}/steps?date=2023-05-05`).set(u.auth);
    expect(list.body.data.items).toHaveLength(1);
  });
});

describe('validation and limits', () => {
  it('validates the envelope', async () => {
    expect((await upload(u, 'd', [])).status).toBe(422);
    expect((await upload(u, 'd', [{ entityType: 'nope', operation: 'CREATE', localId: 'a', idempotencyKey: 'abcdefgh', payload: {} }])).status).toBe(422);
    expect((await upload(u, 'd', [{ entityType: 'water', operation: 'CREATE', idempotencyKey: 'abcdefgh', payload: {} }])).status).toBe(422); // no localId
    expect((await uploadRaw(u, { deviceId: 'd', operations: [{ entityType: 'water', operation: 'CREATE', localId: 'a', idempotencyKey: 'short', payload: {} }] })).status).toBe(422);
    const tooMany = Array.from({ length: 101 }, (_, i) => create(`many-${i}-xxxx`, `m-${i}`));
    expect((await upload(u, 'd', tooMany)).status).toBe(422);
    expect((await request(app).post(`${API}/sync/upload`).set(u.auth).send({ operations: [] })).status).toBe(422); // no deviceId
  });

  it('cannot smuggle another user via payload, and cannot touch their rows by id', async () => {
    const victim = await registerUser(app);
    const theirs = (await request(app).post(`${API}/water`).set(victim.auth).send({ amountMl: 200, date: today(), time: '09:00' })).body.data.id;

    const forged = await upload(u, 'android-1', [create('forge-1', 'forge-l', { amountMl: 1, date: today(), time: '09:00', userId: victim.id })]);
    expect(forged.body.data.results[0]).toMatchObject({ status: 'FAILED', error: { code: 'VALIDATION_ERROR' } });

    const steal = await upload(u, 'android-1', [
      { entityType: 'water', operation: 'UPDATE', entityId: theirs, idempotencyKey: 'steal-1', payload: { amountMl: 1 } },
      { entityType: 'water', operation: 'DELETE', entityId: theirs, idempotencyKey: 'steal-2' },
    ]);
    expect(steal.body.data.results[0]).toMatchObject({ status: 'FAILED', error: { code: 'NOT_FOUND' } });
    expect(steal.body.data.results[1].change).toBeUndefined();
    expect((await request(app).get(`${API}/water/${theirs}`).set(victim.auth)).body.data.amountMl).toBe(200);
  });
});

describe('download changes', () => {
  it('returns changes and deletion tombstones since a timestamp', async () => {
    const user = await registerUser(app);
    const since = new Date(Date.now() - 1000).toISOString();
    const r = await upload(user, 'android-1', [create('dl-1', 'dl-l-1', { amountMl: 100, date: '2024-01-01', time: '10:00' })]);
    const id = r.body.data.idMappings[0].serverId;
    await upload(user, 'android-1', [{ entityType: 'water', operation: 'DELETE', entityId: id, idempotencyKey: 'dl-2' }]);

    const res = await request(app).get(`${API}/sync/changes`).query({ since }).set(user.auth);
    expect(res.status).toBe(200);
    const w = res.body.data.changes.water;
    expect(w).toHaveLength(1);
    expect(w[0].deletedAt).toBeTruthy();
    expect((await request(app).get(`${API}/sync/changes`).query({ since: 'yesterday' }).set(user.auth)).status).toBe(422);
  });
});

describe('guest migration', () => {
  it('moves guest data into the caller\'s account, once', async () => {
    const guest = await registerGuest(app);
    await request(app).post(`${API}/water`).set(guest.auth).send({ amountMl: 300, date: '2024-02-02', time: '08:00' });
    await request(app).post(`${API}/habits`).set(guest.auth).send({ name: 'Guest habit' });

    const account = await registerUser(app);
    const res = await request(app).post(`${API}/sync/migrate-guest`).set(account.auth).send({ guestRefreshToken: guest.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.entities.water.migrated).toBe(1);
    expect(res.body.data.entities.habit.migrated).toBe(1);

    const water = await request(app).get(`${API}/water?date=2024-02-02`).set(account.auth);
    expect(water.body.data.items).toHaveLength(1);
    // The guest identity is retired.
    expect((await request(app).get(`${API}/water`).set(guest.auth)).status).toBe(403);

    // Re-running is a harmless no-op for the same account...
    const again = await request(app).post(`${API}/sync/migrate-guest`).set(account.auth).send({ guestRefreshToken: guest.refreshToken });
    expect(again.status === 200 || again.status === 401).toBe(true);
    // ...and a different account can never claim it.
    const thief = await registerUser(app);
    const steal = await request(app).post(`${API}/sync/migrate-guest`).set(thief.auth).send({ guestRefreshToken: guest.refreshToken });
    expect(steal.status).toBeGreaterThanOrEqual(401);
    expect((await request(app).get(`${API}/water`).set(thief.auth)).body.data.items).toHaveLength(0);
  });

  it('cannot migrate a real user account, and a bare user id is not enough', async () => {
    const victim = await registerUser(app);
    const attacker = await registerUser(app);
    const real = await request(app).post(`${API}/sync/migrate-guest`).set(attacker.auth).send({ guestRefreshToken: victim.refreshToken });
    expect(real.status).toBe(403);
    expect((await request(app).post(`${API}/sync/migrate-guest`).set(attacker.auth).send({ guestRefreshToken: victim.id })).status).toBe(401); // a user id is not a valid refresh token
    expect((await request(app).post(`${API}/sync/migrate-guest`).set(attacker.auth).send({ guestUserId: victim.id })).status).toBe(422);
  });
});
