import { z } from 'zod';
import { REPEAT_TYPES } from '../../common/constants';
import { deviceId, localId, paginationQuery, sortField, timeString } from '../../common/validators';

const days = z.array(z.number().int().min(0).max(6)).max(7).refine((a) => new Set(a).size === a.length, 'Days must be unique');

const base = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).default(''),
  time: timeString,
  repeatType: z.enum(REPEAT_TYPES).default('DAILY'),
  daysOfWeek: days.default([]),
  isEnabled: z.boolean().default(true),
  localId: localId.optional(),
  deviceId: deviceId.optional(),
});

const needsDays = (v: { repeatType?: string; daysOfWeek?: number[] }) =>
  !(v.repeatType === 'CUSTOM' || v.repeatType === 'WEEKLY') || (v.daysOfWeek?.length ?? 0) > 0;

export const createReminderBody = base
  .strict()
  .refine(needsDays, { message: 'daysOfWeek is required for WEEKLY and CUSTOM reminders', path: ['daysOfWeek'] });

export const updateReminderBody = base
  .omit({ localId: true })
  .partial()
  .extend({ version: z.number().int().min(1).optional() })
  .strict();

export const listRemindersQuery = paginationQuery.extend({
  sort: sortField(['time', 'createdAt', 'title'] as const, 'time'),
  order: z.enum(['asc', 'desc']).default('asc'),
  isEnabled: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  repeatType: z.enum(REPEAT_TYPES).optional(),
});
