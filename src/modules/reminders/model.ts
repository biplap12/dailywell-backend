import { Schema, model } from 'mongoose';
import { REPEAT_TYPES } from '../../common/constants';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IReminder } from './types';

const reminderSchema = new Schema<IReminder>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    repeatType: { type: String, enum: REPEAT_TYPES, default: 'DAILY' },
    daysOfWeek: { type: [Number], default: [] },
    isEnabled: { type: Boolean, default: true },
    ...syncFields,
  },
  { timestamps: true, collection: 'reminders' },
);
reminderSchema.index({ userId: 1, isEnabled: 1 });
addSyncIndexes(reminderSchema);
applyJsonTransform(reminderSchema);

export const ReminderModel = model<IReminder>('Reminder', reminderSchema);
