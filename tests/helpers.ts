import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';

export const API = '/api/v1';

export async function connectTestDb(): Promise<void> {
  const base = process.env.TEST_MONGO_URI;
  if (!base) throw new Error('TEST_MONGO_URI not set (globalSetup did not run)');
  const dbName = `dw_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const uri = base.replace(/\/?(\?.*)?$/, `/${dbName}$1`);
  await mongoose.connect(uri);
  await mongoose.syncIndexes();
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
}

export async function buildApp(): Promise<Express> {
  const { createApp } = await import('../src/app');
  return createApp();
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

let counter = 0;
export async function registerUser(app: Express, overrides: Record<string, unknown> = {}): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}_${randomUUID().slice(0, 6)}@example.com`;
  const password = 'password123';
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ name: `Test User ${counter}`, email, phone: '9800000000', password, ...overrides });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { accessToken, refreshToken, user } = res.body.data;
  return { id: user.id, email, password, accessToken, refreshToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

/** Registers a user, then promotes them directly in the database (roles can never be self-assigned over the API). */
export async function registerWithRole(app: Express, role: 'ADMIN' | 'SUPER_ADMIN'): Promise<TestUser> {
  const u = await registerUser(app);
  const { UserModel } = await import('../src/modules/users/model');
  await UserModel.updateOne({ _id: u.id }, { $set: { role } });
  return u;
}

export async function registerGuest(app: Express): Promise<TestUser> {
  const res = await request(app).post(`${API}/auth/guest`).send({});
  if (res.status !== 201) throw new Error(`guest failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { accessToken, refreshToken, user } = res.body.data;
  return { id: user.id, email: '', password: '', accessToken, refreshToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

export const today = () => new Date().toISOString().slice(0, 10);

export function waterBody(overrides: Record<string, unknown> = {}) {
  return { amountMl: 250, date: today(), time: '08:30', ...overrides };
}
