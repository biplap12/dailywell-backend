import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, buildApp, connectTestDb, disconnectTestDb, registerUser, registerWithRole, today, waterBody, type TestUser } from './helpers';

let app: Express;
let u: TestUser;
beforeAll(async () => {
  await connectTestDb();
  app = await buildApp();
  u = await registerUser(app);
});
afterAll(disconnectTestDb);

const post = (path: string, body: unknown) => request(app).post(`${API}${path}`).set(u.auth).send(body as object);
const get = (path: string) => request(app).get(`${API}${path}`).set(u.auth);
const put = (path: string, body: unknown) => request(app).put(`${API}${path}`).set(u.auth).send(body as object);
const del = (path: string) => request(app).delete(`${API}${path}`).set(u.auth);

describe('water', () => {
  it('creates, lists with daily totals, filters by date, paginates and deletes', async () => {
    await post('/water', waterBody({ amountMl: 250 }));
    await post('/water', waterBody({ amountMl: 500, time: '12:00' }));
    const other = await post('/water', waterBody({ amountMl: 300, date: '2020-01-01' }));
    expect(other.status).toBe(201);

    const day = await get(`/water?date=${today()}`);
    expect(day.status).toBe(200);
    expect(day.body.data.items).toHaveLength(2);
    expect(day.body.data.summary.dailyTotals[0]).toMatchObject({ date: today(), totalMl: 750, entries: 2 });
    expect(day.body.data.summary.goalMl).toBe(2500);

    const page = await get('/water?limit=1&page=2&sort=createdAt&order=asc');
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.pagination).toMatchObject({ page: 2, limit: 1, total: 3, totalPages: 3 });

    const id = day.body.data.items[0].id;
    expect((await del(`/water/${id}`)).status).toBe(204);
    expect((await get(`/water/${id}`)).status).toBe(404);
  });

  it('validates input and caps the page size', async () => {
    expect((await post('/water', waterBody({ amountMl: 0 }))).status).toBe(422);
    expect((await post('/water', waterBody({ amountMl: 99999 }))).status).toBe(422);
    expect((await post('/water', waterBody({ date: '2026-02-31' }))).status).toBe(422);
    expect((await post('/water', waterBody({ time: '25:00' }))).status).toBe(422);
    expect((await get('/water?limit=1000')).status).toBe(422);
    expect((await get('/water/not-an-id')).status).toBe(422);
  });

  it('retrying a create with the same localId does not duplicate', async () => {
    const body = waterBody({ localId: 'loc-1', deviceId: 'dev-1', date: '2021-05-05' });
    const a = await post('/water', body);
    const b = await post('/water', body);
    expect(a.body.data.id).toBe(b.body.data.id);
    const list = await get('/water?date=2021-05-05');
    expect(list.body.data.items).toHaveLength(1);
  });
});

describe('sleep', () => {
  const sleep = { date: '2026-10-04', startTime: '2026-10-03T22:30:00.000Z', endTime: '2026-10-04T06:30:00.000Z', qualityScore: 4 };

  it('derives the duration and supports update/delete', async () => {
    const c = await post('/sleep', sleep);
    expect(c.status).toBe(201);
    expect(c.body.data.durationMinutes).toBe(480);

    const upd = await put(`/sleep/${c.body.data.id}`, { endTime: '2026-10-04T07:00:00.000Z', qualityScore: 5 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.durationMinutes).toBe(510);
    expect(upd.body.data.version).toBe(2);

    expect((await del(`/sleep/${c.body.data.id}`)).status).toBe(204);
  });

  it('rejects bad quality scores, reversed times and mismatched durations', async () => {
    expect((await post('/sleep', { ...sleep, qualityScore: 6 })).status).toBe(422);
    expect((await post('/sleep', { ...sleep, qualityScore: 0 })).status).toBe(422);
    expect((await post('/sleep', { ...sleep, startTime: sleep.endTime, endTime: sleep.startTime })).status).toBe(422);
    expect((await post('/sleep', { ...sleep, durationMinutes: 30 })).status).toBe(422);
  });

  it('returns 409 with server data on a stale version', async () => {
    const c = await post('/sleep', { ...sleep, date: '2026-10-01' });
    await put(`/sleep/${c.body.data.id}`, { qualityScore: 2 });
    const stale = await put(`/sleep/${c.body.data.id}`, { qualityScore: 3, version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.serverVersion).toBe(2);
  });
});

describe('habits', () => {
  it('toggles completion, keeps one row per day and computes streaks', async () => {
    const h = await post('/habits', { name: 'Meditate', colorHex: '#112233' });
    expect(h.status).toBe(201);
    const id = h.body.data.id;

    const d = (offset: number) => {
      const x = new Date();
      x.setUTCDate(x.getUTCDate() - offset);
      return x.toISOString().slice(0, 10);
    };

    expect((await post(`/habits/${id}/toggle`, { date: d(2) })).body.data.streakCount).toBe(0); // gap: today & yesterday not done
    expect((await post(`/habits/${id}/toggle`, { date: d(1) })).body.data.streakCount).toBe(2);
    const t = await post(`/habits/${id}/toggle`, { date: d(0) });
    expect(t.body.data).toMatchObject({ isCompleted: true, streakCount: 3 });

    // Toggling again un-completes the same row rather than adding another.
    const off = await post(`/habits/${id}/toggle`, { date: d(0) });
    expect(off.body.data.isCompleted).toBe(false);

    const { HabitCompletionModel } = await import('../src/modules/habits/model');
    expect(await HabitCompletionModel.countDocuments({ habitId: id, date: d(0) })).toBe(1);

    const list = await get(`/habits?date=${d(1)}`);
    expect(list.body.data.items.find((x: any) => x.id === id).isCompletedOnDate).toBe(true);
  });

  it('enforces uniqueness at the database level', async () => {
    const { HabitCompletionModel } = await import('../src/modules/habits/model');
    await HabitCompletionModel.create({ userId: u.id, habitId: 'h1', date: '2026-01-01' });
    await expect(HabitCompletionModel.create({ userId: u.id, habitId: 'h1', date: '2026-01-01' })).rejects.toMatchObject({ code: 11000 });
  });

  it('updates and deletes', async () => {
    const h = await post('/habits', { name: 'Walk' });
    expect((await put(`/habits/${h.body.data.id}`, { name: 'Long walk' })).body.data.name).toBe('Long walk');
    expect((await del(`/habits/${h.body.data.id}`)).status).toBe(204);
    expect((await post('/habits', { name: '' })).status).toBe(422);
    expect((await post('/habits', { name: 'x', colorHex: 'red' })).status).toBe(422);
  });
});

describe('routines', () => {
  it('creates, completes, reorders and deletes', async () => {
    const mk = async (title: string, category = 'MORNING') => (await post('/routines', { title, time: '07:00', category })).body.data.id as string;
    const [a, b, c] = [await mk('Wake'), await mk('Stretch'), await mk('Breakfast')];

    const re = await post('/routines/reorder', { ids: [c, a, b] });
    expect(re.status).toBe(200);
    const ordered = (await get('/routines?sort=sortOrder&order=asc')).body.data.items.map((i: any) => i.id).filter((i: string) => [a, b, c].includes(i));
    expect(ordered).toEqual([c, a, b]);

    const done = await put(`/routines/${a}/complete`, { isCompleted: true });
    expect(done.body.data.isCompleted).toBe(true);
    expect((await del(`/routines/${a}`)).status).toBe(204);
  });

  it('rejects an invalid category and reorder with foreign ids', async () => {
    expect((await post('/routines', { title: 'x', time: '07:00', category: 'NOPE' })).status).toBe(422);
    const other = await registerUser(app);
    const theirs = (await request(app).post(`${API}/routines`).set(other.auth).send({ title: 'Theirs', time: '08:00' })).body.data.id;
    expect((await post('/routines/reorder', { ids: [theirs] })).status).toBe(404);
  });
});

describe('reminders', () => {
  it('CRUD plus repeat-type rules', async () => {
    const r = await post('/reminders', { title: 'Drink', time: '09:00', repeatType: 'DAILY' });
    expect(r.status).toBe(201);
    expect((await put(`/reminders/${r.body.data.id}`, { isEnabled: false })).body.data.isEnabled).toBe(false);
    expect((await get('/reminders?isEnabled=false')).body.data.items.length).toBeGreaterThan(0);
    expect((await post('/reminders', { title: 'Wk', time: '09:00', repeatType: 'WEEKLY' })).status).toBe(422);
    expect((await post('/reminders', { title: 'Wk', time: '09:00', repeatType: 'WEEKLY', daysOfWeek: [1, 3] })).status).toBe(201);
    expect((await post('/reminders', { title: 'Bad', time: '09:00', repeatType: 'HOURLY' })).status).toBe(422);
    expect((await del(`/reminders/${r.body.data.id}`)).status).toBe(204);
  });
});

describe('steps', () => {
  it('keeps one record per day and updates the goal', async () => {
    const a = await post('/steps', { date: '2026-09-01', steps: 1000 });
    const b = await post('/steps', { date: '2026-09-01', steps: 4000, distanceMeters: 3000 });
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(b.body.data.steps).toBe(4000);
    expect((await get('/steps?date=2026-09-01')).body.data.items).toHaveLength(1);

    const goal = await put('/users/step-goal', { stepGoal: 12000 });
    expect(goal.body.data.stepGoal).toBe(12000);
    expect((await put('/users/step-goal', { stepGoal: 5 })).status).toBe(422);
  });

  it('batch upserts and reports stale records as conflicts', async () => {
    const first = await post('/steps/batch', {
      deviceId: 'dev-1',
      records: [{ date: '2026-08-01', steps: 100 }, { date: '2026-08-02', steps: 200 }],
    });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ processed: 2, created: 2 });

    const again = await post('/steps/batch', { deviceId: 'dev-1', records: [{ date: '2026-08-01', steps: 150 }] });
    expect(again.body.data).toMatchObject({ processed: 1, updated: 1 });

    const stale = await post('/steps/batch', {
      deviceId: 'dev-2',
      records: [{ date: '2026-08-01', steps: 5, updatedAt: '2000-01-01T00:00:00.000Z' }],
    });
    expect(stale.body.data.conflicts).toHaveLength(1);
    expect(stale.body.data.conflicts[0]).toMatchObject({ resolution: 'SERVER_WINS', date: '2026-08-01' });
    expect((await get('/steps?date=2026-08-01')).body.data.items[0].steps).toBe(150);

    expect((await post('/steps/batch', { records: [{ date: '2026-08-01', steps: 1 }, { date: '2026-08-01', steps: 2 }] })).status).toBe(422);
    expect((await post('/steps/batch', { records: [] })).status).toBe(422);
  });
});

describe('activities', () => {
  it('create, filter, delete', async () => {
    const a = await post('/activities', { activityType: 'Running', durationMinutes: 30, date: today(), time: '06:30', notes: 'easy' });
    expect(a.status).toBe(201);
    expect((await get('/activities?activityType=Running')).body.data.items.length).toBeGreaterThan(0);
    expect((await post('/activities', { activityType: 'Run', durationMinutes: 0, date: today(), time: '06:30' })).status).toBe(422);
    expect((await del(`/activities/${a.body.data.id}`)).status).toBe(204);
  });
});

describe('calendar', () => {
  it('supports Gregorian and Bikram Sambat dates', async () => {
    const e = await post('/calendar/events', { title: 'Dashain', dateGregorian: '2026-10-20', dateNepali: '2083-07-03', category: 'FESTIVAL', colorHex: '#FF0000' });
    expect(e.status).toBe(201);
    expect((await get('/calendar/events?nepaliDate=2083-07-03')).body.data.items).toHaveLength(1);
    expect((await get('/calendar/events?from=2026-10-01&to=2026-10-31')).body.data.items).toHaveLength(1);
    expect((await put(`/calendar/events/${e.body.data.id}`, { title: 'Vijaya Dashami' })).body.data.title).toBe('Vijaya Dashami');
    expect((await post('/calendar/events', { title: 'No date' })).status).toBe(422);
    expect((await del(`/calendar/events/${e.body.data.id}`)).status).toBe(204);
  });
});

describe('notifications', () => {
  it('lists bilingual notifications, marks read and deletes; users cannot create them', async () => {
    const admin = await registerWithRole(app, 'ADMIN');
    const sent = await request(app)
      .post(`${API}/admin/notifications`)
      .set(admin.auth)
      .send({ userId: u.id, titleEn: 'Hello', titleNe: 'नमस्ते', messageEn: 'Stay hydrated', messageNe: 'पानी पिउनुहोस्', category: 'HEALTH' });
    expect(sent.status).toBe(201);

    const list = await get('/notifications?isRead=false');
    expect(list.body.data.unreadCount).toBe(1);
    expect(list.body.data.items[0]).toMatchObject({ titleNe: 'नमस्ते', isRead: false });

    const id = list.body.data.items[0].id;
    expect((await put(`/notifications/${id}/read`, {})).body.data.isRead).toBe(true);
    expect((await get('/notifications')).body.data.unreadCount).toBe(0);
    expect((await del(`/notifications/${id}`)).status).toBe(204);

    expect((await post('/admin/notifications', { userId: u.id, titleEn: 'x', titleNe: 'x', messageEn: 'x', messageNe: 'x' })).status).toBe(403);
  });
});

describe('holidays', () => {
  it('admins manage holidays; the public list reflects them', async () => {
    const admin = await registerWithRole(app, 'ADMIN');
    const h = await request(app).post(`${API}/config/holidays`).set(admin.auth).send({
      titleEn: 'Constitution Day', titleNe: 'संविधान दिवस', dateGregorian: '2026-09-19', dateNepali: '2083-06-03', type: 'PUBLIC', isNational: true,
    });
    expect(h.status).toBe(201);
    const list = await request(app).get(`${API}/config/holidays?year=2026`);
    expect(list.body.data.items.some((x: any) => x.titleEn === 'Constitution Day')).toBe(true);
    expect((await request(app).delete(`${API}/config/holidays/${h.body.data.id}`).set(admin.auth)).status).toBe(204);
  });
});
