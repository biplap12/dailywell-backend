import { ZodError } from 'zod';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { SYNC_ENTITY_TYPES, type SyncEntityType } from '../../common/constants';
import { logger } from '../../common/utils/logger';
import { adapters, type EntityAdapter, type PrepareContext } from './adapters';
import { DEFAULT_CONFLICT_STRATEGY, getConflictResolver, type ConflictResolver } from './conflictResolver';
import { syncRepository } from './repository';
import type {
  ChangeRecord,
  ConflictInfo,
  ConflictStrategyName,
  OperationResult,
  SyncOperationInput,
  SyncSummary,
} from './types';

interface Ctx extends PrepareContext {
  resolver: ConflictResolver;
}

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

function zodToValidation(err: ZodError): ValidationError {
  return new ValidationError(
    'Invalid operation payload',
    err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

function parseWith(schema: EntityAdapter['createSchema'], data: unknown) {
  const r = schema.safeParse(data);
  if (!r.success) throw zodToValidation(r.error);
  return r.data as Record<string, any>;
}

function changeOf(adapter: EntityAdapter, doc: any, operation: ChangeRecord['operation']): ChangeRecord {
  return {
    entityType: adapter.entityType,
    entityId: String(doc._id),
    localId: doc.localId ?? null,
    operation,
    version: doc.version,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt ?? null,
  };
}

async function findTarget(adapter: EntityAdapter, ctx: Ctx, op: SyncOperationInput): Promise<any> {
  // Includes soft-deleted rows so update-vs-delete races are detected rather than reported as "not found".
  if (op.entityId) {
    if (!OBJECT_ID.test(op.entityId)) throw new NotFoundError(`${adapter.label} not found`);
    const doc = await adapter.model.findOne({ _id: op.entityId, userId: ctx.userId }).exec(); // scoped by userId: IDOR-safe
    if (doc) return doc;
  }
  if (op.localId) {
    const doc = await adapter.model.findOne({ userId: ctx.userId, deviceId: ctx.deviceId, localId: op.localId }).exec();
    if (doc) return doc;
  }
  return null;
}

function detectConflict(current: any, op: SyncOperationInput, ctx: Ctx): { conflict: boolean; clientUpdatedAt: Date } {
  const clientUpdatedAt = op.clientUpdatedAt ? new Date(op.clientUpdatedAt) : new Date();
  const versionMismatch = op.baseVersion !== undefined && op.baseVersion !== current.version;
  // Without a base version we fall back to timestamps, but only across devices:
  // a device cannot conflict with its own earlier writes.
  const staleByTime =
    op.baseVersion === undefined &&
    op.clientUpdatedAt !== undefined &&
    current.updatedAt.getTime() > clientUpdatedAt.getTime() &&
    (current.deviceId ?? null) !== ctx.deviceId;
  return { conflict: versionMismatch || staleByTime, clientUpdatedAt };
}

function buildConflict(adapter: EntityAdapter, current: any, op: SyncOperationInput, clientData: Record<string, unknown>, resolution: ConflictInfo['resolution'], ctx: Ctx): ConflictInfo {
  return {
    entityType: adapter.entityType,
    entityId: String(current._id),
    clientVersion: op.baseVersion ?? null,
    serverVersion: current.version,
    clientData,
    serverData: current.toJSON(),
    resolution,
    strategy: ctx.resolver.name as ConflictStrategyName,
  };
}

/** Shared by UPDATE and by natural-key CREATE (e.g. a step record for a day that already exists). */
async function applyUpdate(adapter: EntityAdapter, current: any, patch: Record<string, any>, op: SyncOperationInput, ctx: Ctx, allowResurrect = false): Promise<OperationResult> {
  const base = { idempotencyKey: op.idempotencyKey, entityType: adapter.entityType, operation: op.operation, entityId: String(current._id), localId: op.localId };
  const { version: _v, localId: _l, ...cleanPatch } = patch;

  if (current.deletedAt && !allowResurrect) {
    // Update vs delete: the delete stands. We never resurrect data the user removed elsewhere.
    const conflict = buildConflict(adapter, current, op, cleanPatch, 'SERVER_WINS', ctx);
    return { ...base, status: 'CONFLICT', version: current.version, conflict };
  }

  const { conflict: hasConflict, clientUpdatedAt } = current.deletedAt ? { conflict: false, clientUpdatedAt: new Date() } : detectConflict(current, op, ctx);

  let conflictInfo: ConflictInfo | undefined;
  if (hasConflict) {
    const resolution = ctx.resolver.resolve({
      clientUpdatedAt,
      serverUpdatedAt: current.updatedAt,
      clientDeviceId: ctx.deviceId,
      serverDeviceId: current.deviceId ?? null,
    });
    conflictInfo = buildConflict(adapter, current, op, cleanPatch, resolution, ctx);
    if (resolution === 'SERVER_WINS') {
      return { ...base, status: 'CONFLICT', version: current.version, conflict: conflictInfo };
    }
  }

  const prepared = adapter.prepareUpdate ? await adapter.prepareUpdate(current, cleanPatch, ctx) : cleanPatch;
  const setFields: Record<string, any> = { ...prepared, deviceId: ctx.deviceId, syncStatus: 'SYNCED' };
  if (current.deletedAt) setFields.deletedAt = null;
  if (!current.localId && op.localId) setFields.localId = op.localId;

  const updated = await adapter.model
    .findOneAndUpdate(
      { _id: current._id, userId: ctx.userId, version: current.version },
      { $set: setFields, $inc: { version: 1 } },
      { new: true, runValidators: true },
    )
    .exec();
  if (!updated) throw new ConflictError('Record was modified concurrently, please retry');
  if (adapter.afterWrite) await adapter.afterWrite(updated, ctx);

  return {
    ...base,
    status: conflictInfo ? 'CONFLICT' : 'PROCESSED',
    version: updated.version,
    change: changeOf(adapter, updated, 'UPDATE'),
    ...(conflictInfo ? { conflict: conflictInfo } : {}),
    ...(op.localId ? { idMapping: { entityType: adapter.entityType, localId: op.localId, serverId: String(updated._id) } } : {}),
  };
}

async function doCreate(adapter: EntityAdapter, ctx: Ctx, op: SyncOperationInput): Promise<OperationResult> {
  const base = { idempotencyKey: op.idempotencyKey, entityType: adapter.entityType, operation: op.operation, localId: op.localId };

  // Same device + same localId is the same row, whatever idempotency key carried it.
  const byLocal = await adapter.model.findOne({ userId: ctx.userId, deviceId: ctx.deviceId, localId: op.localId }).exec();
  if (byLocal) {
    return { ...base, status: 'DUPLICATE', entityId: String(byLocal._id), version: byLocal.version, idMapping: { entityType: adapter.entityType, localId: op.localId!, serverId: String(byLocal._id) } };
  }

  const parsed = parseWith(adapter.createSchema, { ...op.payload, localId: op.localId, deviceId: ctx.deviceId });
  const prepared = adapter.prepareCreate ? await adapter.prepareCreate(parsed, ctx) : parsed;

  if (adapter.naturalKey) {
    const key = { userId: ctx.userId, ...adapter.naturalKey(ctx.userId, prepared) };
    const existing = await adapter.model.findOne(key).exec();
    if (existing) return applyUpdate(adapter, existing, prepared, op, ctx, true);
  }

  try {
    const created = await adapter.model.create({
      ...prepared,
      userId: ctx.userId,
      localId: op.localId,
      clientId: `${ctx.deviceId}:${op.localId}`,
      deviceId: ctx.deviceId,
      version: 1,
      deletedAt: null,
      syncStatus: 'SYNCED',
    });
    if (adapter.afterWrite) await adapter.afterWrite(created, ctx);
    return {
      ...base,
      status: 'PROCESSED',
      entityId: String(created._id),
      version: created.version,
      idMapping: { entityType: adapter.entityType, localId: op.localId!, serverId: String(created._id) },
      change: changeOf(adapter, created, 'CREATE'),
    };
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // Lost a race with a concurrent identical create: resolve against the row that now exists.
    const winner =
      (await adapter.model.findOne({ userId: ctx.userId, deviceId: ctx.deviceId, localId: op.localId }).exec()) ??
      (adapter.naturalKey ? await adapter.model.findOne({ userId: ctx.userId, ...adapter.naturalKey(ctx.userId, prepared) }).exec() : null);
    if (!winner) throw err;
    return { ...base, status: 'DUPLICATE', entityId: String(winner._id), version: winner.version, idMapping: { entityType: adapter.entityType, localId: op.localId!, serverId: String(winner._id) } };
  }
}

async function doUpdate(adapter: EntityAdapter, ctx: Ctx, op: SyncOperationInput): Promise<OperationResult> {
  const current = await findTarget(adapter, ctx, op);
  if (!current) throw new NotFoundError(`${adapter.label} not found`);
  const patch = parseWith(adapter.updateSchema, { ...op.payload, deviceId: ctx.deviceId });
  return applyUpdate(adapter, current, patch, op, ctx);
}

async function doDelete(adapter: EntityAdapter, ctx: Ctx, op: SyncOperationInput): Promise<OperationResult> {
  const base = { idempotencyKey: op.idempotencyKey, entityType: adapter.entityType, operation: op.operation, localId: op.localId };
  const current = await findTarget(adapter, ctx, op);

  // Deleting something that is already gone is a success: deletes are idempotent.
  if (!current) return { ...base, status: 'PROCESSED' };
  if (current.deletedAt) return { ...base, status: 'PROCESSED', entityId: String(current._id), version: current.version };

  const { conflict: hasConflict, clientUpdatedAt } = detectConflict(current, op, ctx);
  let conflictInfo: ConflictInfo | undefined;
  if (hasConflict) {
    const resolution = ctx.resolver.resolve({ clientUpdatedAt, serverUpdatedAt: current.updatedAt, clientDeviceId: ctx.deviceId, serverDeviceId: current.deviceId ?? null });
    conflictInfo = buildConflict(adapter, current, op, { deleted: true }, resolution, ctx);
    if (resolution === 'SERVER_WINS') {
      return { ...base, status: 'CONFLICT', entityId: String(current._id), version: current.version, conflict: conflictInfo };
    }
  }

  const deleted = await adapter.model
    .findOneAndUpdate(
      { _id: current._id, userId: ctx.userId, version: current.version, deletedAt: null },
      { $set: { deletedAt: new Date(), deviceId: ctx.deviceId, syncStatus: 'SYNCED' }, $inc: { version: 1 } },
      { new: true },
    )
    .exec();
  if (!deleted) throw new ConflictError('Record was modified concurrently, please retry');
  if (adapter.afterDelete) await adapter.afterDelete(deleted, ctx);

  return {
    ...base,
    status: conflictInfo ? 'CONFLICT' : 'PROCESSED',
    entityId: String(deleted._id),
    version: deleted.version,
    change: changeOf(adapter, deleted, 'DELETE'),
    ...(conflictInfo ? { conflict: conflictInfo } : {}),
  };
}

function failure(op: SyncOperationInput, err: { code: string; message: string; details?: unknown }): OperationResult {
  return {
    idempotencyKey: op.idempotencyKey,
    entityType: op.entityType,
    operation: op.operation,
    localId: op.localId,
    entityId: op.entityId,
    status: 'FAILED',
    error: err,
  };
}

async function processOperation(userId: string, ctx: Ctx, op: SyncOperationInput): Promise<OperationResult> {
  const claim = await syncRepository.claim(userId, ctx.deviceId, op);

  if (!claim.claimed) {
    const { existing } = claim;
    if (existing.state === 'DONE' && existing.result) {
      // Safe retry: hand back the original outcome without touching any data.
      return { ...existing.result, status: 'DUPLICATE', replayed: true };
    }
    return failure(op, { code: 'OPERATION_IN_PROGRESS', message: 'This operation is already being processed; retry shortly' });
  }

  const adapter = adapters[op.entityType];
  try {
    const result =
      op.operation === 'CREATE' ? await doCreate(adapter, ctx, op) : op.operation === 'UPDATE' ? await doUpdate(adapter, ctx, op) : await doDelete(adapter, ctx, op);
    await syncRepository.complete(userId, op.idempotencyKey, result);
    return result;
  } catch (err) {
    if (err instanceof AppError && err.isOperational && !(err instanceof ConflictError)) {
      // Deterministic failure (validation, not found...): record it so replays return the same answer.
      const result = failure(op, { code: err.code, message: err.message, details: err.details });
      await syncRepository.complete(userId, op.idempotencyKey, result);
      return result;
    }
    // Transient / unexpected: release the key so the client's retry really re-executes.
    await syncRepository.release(userId, op.idempotencyKey);
    if (!(err instanceof AppError)) logger.error({ err, entityType: op.entityType, operation: op.operation }, 'Sync operation failed unexpectedly');
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
    return failure(op, { code, message: err instanceof ConflictError ? err.message : 'Operation failed, please retry' });
  }
}

export const syncService = {
  /**
   * Processes a batch of offline operations in order (later operations may depend on earlier ones,
   * e.g. a habit completion that references a habit created in the same batch).
   * One failing operation never aborts the others.
   */
  async upload(userId: string, body: { deviceId: string; operations: SyncOperationInput[]; conflictStrategy?: ConflictStrategyName }): Promise<SyncSummary> {
    const ctx: Ctx = {
      userId,
      deviceId: body.deviceId,
      resolver: getConflictResolver(body.conflictStrategy ?? DEFAULT_CONFLICT_STRATEGY),
    };

    const summary: SyncSummary = { processed: 0, failed: 0, conflicts: 0, duplicates: 0, idMappings: [], changes: [], conflictDetails: [], results: [] };

    for (const op of body.operations) {
      const result = await processOperation(userId, ctx, op);
      summary.results.push(result);
      if (result.idMapping) summary.idMappings.push(result.idMapping);
      if (result.change) summary.changes.push(result.change);
      if (result.conflict) {
        summary.conflicts += 1;
        summary.conflictDetails.push(result.conflict);
      }
      if (result.status === 'FAILED') summary.failed += 1;
      else summary.processed += 1; // PROCESSED, DUPLICATE and resolved CONFLICT all completed without error
      if (result.status === 'DUPLICATE') summary.duplicates += 1;
    }

    // De-duplicate mappings (a replayed create reports the same mapping again).
    const seen = new Set<string>();
    summary.idMappings = summary.idMappings.filter((m) => {
      const k = `${m.entityType}:${m.localId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return summary;
  },

  /**
   * Download side of sync: everything (including deletion tombstones) changed since `since`.
   * Uses >= so rows sharing the boundary timestamp are never skipped; clients dedupe by id + version.
   */
  async changes(userId: string, since: Date, limit: number) {
    const serverTime = new Date();
    const changes: Record<string, unknown[]> = {};
    let nextSince: Date | null = null;
    let hasMore = false;

    for (const type of SYNC_ENTITY_TYPES as readonly SyncEntityType[]) {
      const { model } = adapters[type];
      const docs = await model
        .find({ userId, updatedAt: { $gte: since } })
        .sort({ updatedAt: 1, _id: 1 })
        .limit(limit + 1)
        .exec();
      const truncated = docs.length > limit;
      const page = truncated ? docs.slice(0, limit) : docs;
      changes[type] = page.map((d) => d.toJSON());
      if (truncated) {
        hasMore = true;
        const last = page[page.length - 1].updatedAt as Date;
        if (!nextSince || last < nextSince) nextSince = last;
      }
    }

    return { serverTime, since, hasMore, nextSince: hasMore ? nextSince : serverTime, changes };
  },
};
