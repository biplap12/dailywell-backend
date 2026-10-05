import type { Schema, SchemaDefinition } from 'mongoose';
import { SYNC_STATUSES } from '../constants';

/** Fields shared by every entity that participates in offline sync. */
export const syncFields: SchemaDefinition = {
  localId: { type: String, default: null, maxlength: 128 },
  clientId: { type: String, default: null, maxlength: 128 },
  deviceId: { type: String, default: null, maxlength: 128 },
  version: { type: Number, default: 1, min: 1 },
  deletedAt: { type: Date, default: null },
  syncStatus: { type: String, enum: SYNC_STATUSES, default: 'SYNCED' },
};

/** Consistent JSON shape: `id` instead of `_id`, no `__v`. */
export function applyJsonTransform(schema: Schema, hidden: string[] = []): void {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  });
}
