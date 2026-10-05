import type { FilterQuery, Model, Schema } from 'mongoose';
import { ConflictError, NotFoundError } from '../errors';
import { buildPagination, skipFor } from './pagination';

/**
 * Helpers for entities that belong to exactly one user.
 *
 * IDOR protection lives here: every lookup is scoped by `userId` taken from the
 * verified JWT. A record owned by someone else is indistinguishable from a
 * record that does not exist (404), so ids cannot be probed.
 */

export function addSyncIndexes(schema: Schema): void {
  // Same client-generated localId from the same device can only ever map to one server row.
  schema.index(
    { userId: 1, deviceId: 1, localId: 1 },
    { unique: true, partialFilterExpression: { localId: { $type: 'string' } } },
  );
  schema.index({ userId: 1, updatedAt: 1 }); // delta-sync queries
}

export async function findOwned<T = any>(model: Model<any>, userId: string, id: string, label = 'Record', includeDeleted = false): Promise<T> {
  const filter: FilterQuery<any> = { _id: id, userId };
  if (!includeDeleted) filter.deletedAt = null;
  const doc = await model.findOne(filter).exec();
  if (!doc) throw new NotFoundError(`${label} not found`);
  return doc as T;
}

export interface ListOptions {
  filter?: FilterQuery<any>;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
}

export async function listOwned(model: Model<any>, userId: string, opts: ListOptions) {
  const query: FilterQuery<any> = { ...(opts.filter ?? {}), userId, deletedAt: null };
  const dir = opts.order === 'asc' ? 1 : -1;
  // Secondary sort on _id keeps pagination stable when the primary key ties.
  const sort: Record<string, 1 | -1> = { [opts.sort]: dir, _id: dir };
  const [docs, total] = await Promise.all([
    model.find(query).sort(sort).skip(skipFor(opts.page, opts.limit)).limit(opts.limit).exec(),
    model.countDocuments(query).exec(),
  ]);
  return { items: docs.map((d) => d.toJSON()), pagination: buildPagination(opts.page, opts.limit, total) };
}

/** Idempotent create: retrying the same (deviceId, localId) returns the existing row instead of duplicating it. */
export async function createOwned(model: Model<any>, userId: string, data: Record<string, any>) {
  if (data.localId) {
    const existing = await model.findOne({ userId, deviceId: data.deviceId ?? null, localId: data.localId }).exec();
    if (existing) return existing;
  }
  try {
    return await model.create({ ...data, userId, version: 1, deletedAt: null });
  } catch (err) {
    if ((err as { code?: number }).code === 11000 && data.localId) {
      const existing = await model.findOne({ userId, deviceId: data.deviceId ?? null, localId: data.localId }).exec();
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Update with optimistic concurrency.
 * If the client states which `version` it edited and the server has moved on,
 * we refuse with 409 plus the server copy rather than silently overwriting.
 */
export async function updateOwned(
  model: Model<any>,
  userId: string,
  id: string,
  patch: Record<string, any>,
  label = 'Record',
  expectedVersion?: number,
) {
  const current = await findOwned(model, userId, id, label);
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    throw new ConflictError('Version conflict: the record was modified elsewhere', {
      clientVersion: expectedVersion,
      serverVersion: current.version,
      serverData: current.toJSON(),
    });
  }
  const updated = await model
    .findOneAndUpdate(
      { _id: id, userId, deletedAt: null, version: current.version },
      { $set: patch, $inc: { version: 1 } },
      { new: true, runValidators: true },
    )
    .exec();
  if (!updated) throw new ConflictError('Record was modified concurrently, please retry');
  return updated;
}

export async function softDeleteOwned(model: Model<any>, userId: string, id: string, label = 'Record') {
  await findOwned(model, userId, id, label);
  await model
    .updateOne({ _id: id, userId, deletedAt: null }, { $set: { deletedAt: new Date() }, $inc: { version: 1 } })
    .exec();
}

export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
