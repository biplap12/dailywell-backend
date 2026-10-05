import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IStepRecord } from './types';

const stepSchema = new Schema<IStepRecord>(
  {
    userId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    steps: { type: Number, required: true, min: 0, max: 200000 },
    goal: { type: Number, default: 8000, min: 1000, max: 100000 },
    distanceMeters: { type: Number, default: 0, min: 0, max: 500000 },
    caloriesKcal: { type: Number, default: 0, min: 0, max: 20000 },
    activeMinutes: { type: Number, default: 0, min: 0, max: 1440 },
    ...syncFields,
  },
  { timestamps: true, collection: 'step_records' },
);

// One record per user per day.
stepSchema.index({ userId: 1, date: 1 }, { unique: true });
addSyncIndexes(stepSchema);
applyJsonTransform(stepSchema);

export const StepModel = model<IStepRecord>('StepRecord', stepSchema);
