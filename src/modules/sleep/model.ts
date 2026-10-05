import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { ISleepEntry } from './types';

const sleepSchema = new Schema<ISleepEntry>(
  {
    userId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    qualityScore: { type: Number, required: true, min: 1, max: 5 },
    ...syncFields,
  },
  { timestamps: true, collection: 'sleep_entries' },
);

sleepSchema.index({ userId: 1, date: 1 });
sleepSchema.index({ userId: 1, createdAt: -1 });
addSyncIndexes(sleepSchema);
applyJsonTransform(sleepSchema);

export const SleepModel = model<ISleepEntry>('SleepEntry', sleepSchema);
