import { SyncOperationModel } from './model';
import type { ISyncOperation, OperationResult, SyncOperationInput } from './types';

/** A PROCESSING claim older than this is considered abandoned (crashed worker) and may be taken over. */
const STALE_CLAIM_MS = 60_000;

export type ClaimOutcome = { claimed: true } | { claimed: false; existing: ISyncOperation };

export const syncRepository = {
  /**
   * Atomically claims an idempotency key. The unique (userId, idempotencyKey) index is the
   * arbiter, so two concurrent retries of the same operation can never both execute.
   */
  async claim(userId: string, deviceId: string, op: SyncOperationInput): Promise<ClaimOutcome> {
    try {
      await SyncOperationModel.create({
        userId,
        deviceId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        operation: op.operation,
        localId: op.localId ?? null,
        state: 'PROCESSING',
      });
      return { claimed: true };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }

    const existing = await SyncOperationModel.findOne({ userId, idempotencyKey: op.idempotencyKey }).lean();
    if (!existing) return syncRepository.claim(userId, deviceId, op); // row expired between the two calls

    if (existing.state === 'PROCESSING') {
      const takeover = await SyncOperationModel.findOneAndUpdate(
        { _id: existing._id, state: 'PROCESSING', createdAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        { $set: { createdAt: new Date(), deviceId } },
      ).lean();
      if (takeover) return { claimed: true };
    }
    return { claimed: false, existing: existing as ISyncOperation };
  },

  complete(userId: string, idempotencyKey: string, result: OperationResult) {
    return SyncOperationModel.updateOne(
      { userId, idempotencyKey },
      { $set: { state: 'DONE', result, entityId: result.entityId ?? null, processedAt: new Date() } },
    ).exec();
  },

  /** Free the key after a transient failure so the client's retry actually re-executes. */
  release(userId: string, idempotencyKey: string) {
    return SyncOperationModel.deleteOne({ userId, idempotencyKey, state: 'PROCESSING' }).exec();
  },
};
