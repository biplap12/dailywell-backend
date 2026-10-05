import { z } from 'zod';
import { dateString, deviceId, localId, paginationQuery, sortField, timeString } from '../../common/validators';

export const createActivityBody = z
  .object({
    activityType: z.string().trim().min(1).max(60),
    durationMinutes: z.number().int().min(1).max(1440),
    date: dateString,
    time: timeString,
    notes: z.string().trim().max(500).default(''),
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

export const updateActivityBody = z
  .object({
    activityType: z.string().trim().min(1).max(60).optional(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    date: dateString.optional(),
    time: timeString.optional(),
    notes: z.string().trim().max(500).optional(),
    deviceId: deviceId.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const listActivitiesQuery = paginationQuery.extend({
  sort: sortField(['date', 'createdAt', 'durationMinutes'] as const, 'date'),
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  activityType: z.string().trim().min(1).max(60).optional(),
});
