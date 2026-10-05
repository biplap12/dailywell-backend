import { z } from 'zod';
import { dateString, deviceId, localId, paginationQuery, sortField } from '../../common/validators';

const metrics = {
  steps: z.number().int().min(0).max(200000),
  goal: z.number().int().min(1000).max(100000).optional(),
  distanceMeters: z.number().min(0).max(500000).optional(),
  caloriesKcal: z.number().min(0).max(20000).optional(),
  activeMinutes: z.number().int().min(0).max(1440).optional(),
};

export const createStepBody = z
  .object({
    date: dateString,
    ...metrics,
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

export const updateStepBody = z
  .object({
    date: dateString.optional(),
    steps: metrics.steps.optional(),
    goal: metrics.goal,
    distanceMeters: metrics.distanceMeters,
    caloriesKcal: metrics.caloriesKcal,
    activeMinutes: metrics.activeMinutes,
    deviceId: deviceId.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

const batchRecord = z
  .object({
    date: dateString,
    ...metrics,
    localId: localId.optional(),
    // Client-side last-modified time, used for last-write-wins.
    updatedAt: z.string().datetime({ offset: true }).optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const batchStepsBody = z
  .object({
    deviceId: deviceId.optional(),
    records: z.array(batchRecord).min(1).max(100),
  })
  .strict()
  .refine((v) => new Set(v.records.map((r) => r.date)).size === v.records.length, {
    message: 'records must not contain duplicate dates',
    path: ['records'],
  });

export const listStepsQuery = paginationQuery.extend({
  sort: sortField(['date', 'steps', 'createdAt'] as const, 'date'),
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
