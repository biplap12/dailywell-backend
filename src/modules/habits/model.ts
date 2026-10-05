import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IHabit, IHabitCompletion } from './types';

const habitSchema = new Schema<IHabit>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    reminderTime: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    colorHex: { type: String, default: '#4CAF50', match: /^#?[0-9a-fA-F]{6}$/ },
    streakCount: { type: Number, default: 0, min: 0 },
    sortOrder: { type: Number, default: 0 },
    ...syncFields,
  },
  { timestamps: true, collection: 'habits' },
);
habitSchema.index({ userId: 1, sortOrder: 1 });
habitSchema.index({ userId: 1, deletedAt: 1 });
addSyncIndexes(habitSchema);
applyJsonTransform(habitSchema);
export const HabitModel = model<IHabit>('Habit', habitSchema);

const completionSchema = new Schema<IHabitCompletion>(
  {
    userId: { type: String, required: true },
    habitId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    isCompleted: { type: Boolean, default: true },
    completedAt: { type: Date, default: null },
    ...syncFields,
  },
  { timestamps: true, collection: 'habit_completions' },
);
// One completion row per habit per day - duplicates are impossible at the DB level.
completionSchema.index({ habitId: 1, date: 1 }, { unique: true });
completionSchema.index({ userId: 1, date: 1 });
addSyncIndexes(completionSchema);
applyJsonTransform(completionSchema);
export const HabitCompletionModel = model<IHabitCompletion>('HabitCompletion', completionSchema);
