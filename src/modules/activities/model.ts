import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IActivityLog } from './types';

const activitySchema = new Schema<IActivityLog>(
  {
    userId: { type: String, required: true },
    activityType: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    ...syncFields,
  },
  { timestamps: true, collection: 'activity_logs' },
);
activitySchema.index({ userId: 1, date: 1 });
addSyncIndexes(activitySchema);
applyJsonTransform(activitySchema);

export const ActivityModel = model<IActivityLog>('ActivityLog', activitySchema);
