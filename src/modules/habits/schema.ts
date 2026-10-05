import { z } from 'zod';
import { dateString, deviceId, hexColor, localId, paginationQuery, sortField, timeString } from '../../common/validators';

export const createHabitBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).default(''),
    reminderTime: timeString.nullable().optional(),
    colorHex: hexColor.default('#4CAF50'),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

export const updateHabitBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    reminderTime: timeString.nullable().optional(),
    colorHex: hexColor.optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    deviceId: deviceId.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const toggleHabitBody = z
  .object({
    date: dateString.optional(),
    isCompleted: z.boolean().optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

export const listHabitsQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  order: z.enum(['asc', 'desc']).default('asc'),
  sort: sortField(['sortOrder', 'createdAt', 'name', 'streakCount'] as const, 'sortOrder'),
  date: dateString.optional(),
});

/** Sync payload for habit completions. */
export const habitCompletionSyncBody = z
  .object({
    // Server id of the habit, or the localId of a habit created earlier in the same sync batch.
    habitId: z.string().trim().min(1).max(128),
    date: dateString,
    isCompleted: z.boolean().default(true),
    completedAt: z.string().datetime({ offset: true }).optional(),
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();
