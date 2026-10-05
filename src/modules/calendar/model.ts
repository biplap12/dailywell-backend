import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { ICalendarEvent } from './types';

const calendarSchema = new Schema<ICalendarEvent>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    dateGregorian: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    dateNepali: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    category: { type: String, default: 'GENERAL', trim: true, maxlength: 50 },
    colorHex: { type: String, default: '#2196F3', match: /^#?[0-9a-fA-F]{6}$/ },
    ...syncFields,
  },
  { timestamps: true, collection: 'calendar_events' },
);
calendarSchema.index({ userId: 1, dateGregorian: 1 });
calendarSchema.index({ userId: 1, dateNepali: 1 });
addSyncIndexes(calendarSchema);
applyJsonTransform(calendarSchema);

export const CalendarModel = model<ICalendarEvent>('CalendarEvent', calendarSchema);
