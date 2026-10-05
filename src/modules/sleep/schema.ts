import { z } from 'zod';
import { dateString, deviceId, localId, paginationQuery, sortField } from '../../common/validators';

const isoDateTime = z.string().datetime({ offset: true, message: 'Must be an ISO-8601 datetime' });

const base = z.object({
  date: dateString,
  startTime: isoDateTime,
  endTime: isoDateTime,
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  qualityScore: z.number().int().min(1).max(5),
  localId: localId.optional(),
  deviceId: deviceId.optional(),
});

function endAfterStart(v: { startTime?: string; endTime?: string }): boolean {
  if (!v.startTime || !v.endTime) return true;
  return new Date(v.endTime).getTime() > new Date(v.startTime).getTime();
}

export const createSleepBody = base.strict().refine(endAfterStart, { message: 'endTime must be after startTime', path: ['endTime'] });

export const updateSleepBody = base
  .omit({ localId: true })
  .partial()
  .extend({ version: z.number().int().min(1).optional() })
  .strict()
  .refine(endAfterStart, { message: 'endTime must be after startTime', path: ['endTime'] });

export const listSleepQuery = paginationQuery.extend({
  sort: sortField(['date', 'createdAt', 'durationMinutes', 'qualityScore'] as const, 'date'),
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
