import { Schema, model } from 'mongoose';
import type { ISyncOperation } from './types';

/** Collection: sync_operations. The idempotency ledger - one row per processed client operation. */
const syncOperationSchema = new Schema<ISyncOperation>(
  {
    userId: { type: String, required: true },
    deviceId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, maxlength: 200 },
    entityType: { type: String, required: true },
    operation: { type: String, required: true },
    localId: { type: String, default: null },
    entityId: { type: String, default: null },
    state: { type: String, enum: ['PROCESSING', 'DONE'], default: 'PROCESSING' },
    result: { type: Schema.Types.Mixed, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'sync_operations' },
);

// A key is unique per user: replaying it can never create a second row.
syncOperationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
syncOperationSchema.index({ userId: 1, deviceId: 1, createdAt: -1 });
// Keep the ledger for 90 days, which comfortably exceeds any realistic offline period.
syncOperationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const SyncOperationModel = model<ISyncOperation>('SyncOperation', syncOperationSchema);
