import type { Model } from 'mongoose';
import type { ZodTypeAny } from 'zod';
import { NotFoundError, ValidationError } from '../../common/errors';
import type { SyncEntityType } from '../../common/constants';
import { ActivityModel } from '../activities/model';
import { createActivityBody, updateActivityBody } from '../activities/schema';
import { CalendarModel } from '../calendar/model';
import { createEventBody, updateEventBody } from '../calendar/schema';
import { habitCompletionSyncBody, createHabitBody, updateHabitBody } from '../habits/schema';
import { HabitCompletionModel, HabitModel } from '../habits/model';
import { habitRepository } from '../habits/repository';
import { habitService } from '../habits/service';
import { ReminderModel } from '../reminders/model';
import { createReminderBody, updateReminderBody } from '../reminders/schema';
import { RoutineModel } from '../routines/model';
import { createRoutineBody, updateRoutineBody } from '../routines/schema';
import { routineRepository } from '../routines/repository';
import { SleepModel } from '../sleep/model';
import { createSleepBody, updateSleepBody } from '../sleep/schema';
import { StepModel } from '../steps/model';
import { createStepBody, updateStepBody } from '../steps/schema';
import { WaterModel } from '../water/model';
import { createWaterBody, updateWaterBody } from '../water/schema';

export interface PrepareContext {
  userId: string;
  deviceId: string;
}

export interface EntityAdapter {
  entityType: SyncEntityType;
  label: string;
  model: Model<any>;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  /** Filter that identifies an existing row with the same business identity (one step record per day, etc.) */
  naturalKey?: (userId: string, data: Record<string, any>) => Record<string, unknown>;
  /** Normalise / authorise data before it is written (ownership checks, derived fields). */
  prepareCreate?: (data: Record<string, any>, ctx: PrepareContext) => Promise<Record<string, any>>;
  prepareUpdate?: (current: any, patch: Record<string, any>, ctx: PrepareContext) => Promise<Record<string, any>>;
  /** Runs after a write has been persisted. */
  afterWrite?: (doc: any, ctx: PrepareContext) => Promise<void>;
  afterDelete?: (doc: any, ctx: PrepareContext) => Promise<void>;
}

const sleepMinutes = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / 60000);

function prepareSleepFields(data: Record<string, any>, current?: any): Record<string, any> {
  const start = data.startTime ? new Date(data.startTime) : current?.startTime;
  const end = data.endTime ? new Date(data.endTime) : current?.endTime;
  if (!start || !end) return data;
  const duration = sleepMinutes(start, end);
  if (duration < 1 || duration > 1440) throw new ValidationError('Sleep duration must be between 1 minute and 24 hours');
  return { ...data, startTime: start, endTime: end, durationMinutes: duration };
}

async function resolveHabitId(rawHabitId: string, ctx: PrepareContext): Promise<string> {
  // Server id: verify the habit belongs to THIS user (IDOR guard).
  if (/^[a-fA-F0-9]{24}$/.test(rawHabitId)) {
    const habit = await HabitModel.findOne({ _id: rawHabitId, userId: ctx.userId, deletedAt: null }).select('_id').lean();
    if (habit) return String(habit._id);
  }
  // Otherwise treat it as a localId of a habit created earlier by this device.
  const byLocal = await HabitModel.findOne({ userId: ctx.userId, deviceId: ctx.deviceId, localId: rawHabitId, deletedAt: null }).select('_id').lean();
  if (byLocal) return String(byLocal._id);
  throw new NotFoundError('Habit not found');
}

export const adapters: Record<SyncEntityType, EntityAdapter> = {
  water: {
    entityType: 'water',
    label: 'Water entry',
    model: WaterModel,
    createSchema: createWaterBody,
    updateSchema: updateWaterBody,
  },
  sleep: {
    entityType: 'sleep',
    label: 'Sleep entry',
    model: SleepModel,
    createSchema: createSleepBody,
    updateSchema: updateSleepBody,
    prepareCreate: async (d) => prepareSleepFields(d),
    prepareUpdate: async (current, patch) => prepareSleepFields(patch, current),
  },
  habit: {
    entityType: 'habit',
    label: 'Habit',
    model: HabitModel,
    createSchema: createHabitBody,
    updateSchema: updateHabitBody,
    prepareCreate: async (d, ctx) => ({ ...d, sortOrder: d.sortOrder ?? (await habitRepository.nextSortOrder(ctx.userId)), streakCount: 0 }),
    afterDelete: async (doc) => {
      await habitRepository.deleteCompletionsForHabit(String(doc._id));
    },
  },
  habit_completion: {
    entityType: 'habit_completion',
    label: 'Habit completion',
    model: HabitCompletionModel,
    createSchema: habitCompletionSyncBody,
    updateSchema: habitCompletionSyncBody.partial(),
    naturalKey: (userId, d) => ({ habitId: d.habitId, date: d.date }),
    prepareCreate: async (d, ctx) => {
      const habitId = await resolveHabitId(d.habitId, ctx);
      const completedAt = d.isCompleted === false ? null : d.completedAt ? new Date(d.completedAt) : new Date();
      return { ...d, habitId, completedAt };
    },
    prepareUpdate: async (current, patch) => {
      // The habit a completion belongs to can never be changed by an update.
      const { habitId: _ignored, date: _ignoredDate, ...rest } = patch;
      const next: Record<string, any> = { ...rest };
      if (rest.isCompleted !== undefined) next.completedAt = rest.isCompleted ? (rest.completedAt ? new Date(rest.completedAt) : new Date()) : null;
      return next;
    },
    afterWrite: async (doc, ctx) => {
      await habitService.refreshStreak(String(doc.habitId), ctx.userId); // current streak, as of today
    },
  },
  routine: {
    entityType: 'routine',
    label: 'Routine',
    model: RoutineModel,
    createSchema: createRoutineBody,
    updateSchema: updateRoutineBody,
    prepareCreate: async (d, ctx) => ({ ...d, sortOrder: d.sortOrder ?? (await routineRepository.nextSortOrder(ctx.userId)) }),
  },
  reminder: {
    entityType: 'reminder',
    label: 'Reminder',
    model: ReminderModel,
    createSchema: createReminderBody,
    updateSchema: updateReminderBody,
  },
  steps: {
    entityType: 'steps',
    label: 'Step record',
    model: StepModel,
    createSchema: createStepBody,
    updateSchema: updateStepBody,
    naturalKey: (userId, d) => ({ userId, date: d.date }),
  },
  activity: {
    entityType: 'activity',
    label: 'Activity',
    model: ActivityModel,
    createSchema: createActivityBody,
    updateSchema: updateActivityBody,
  },
  calendar_event: {
    entityType: 'calendar_event',
    label: 'Calendar event',
    model: CalendarModel,
    createSchema: createEventBody,
    updateSchema: updateEventBody,
  },
};
