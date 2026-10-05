import { z } from 'zod';
import { ROUTINE_CATEGORIES } from '../../common/constants';
import { deviceId, localId, objectId, paginationQuery, sortField, timeString } from '../../common/validators';

export const createRoutineBody = z
  .object({
    title: z.string().trim().min(1).max(150),
    time: timeString,
    category: z.enum(ROUTINE_CATEGORIES).default('CUSTOM'),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    isCompleted: z.boolean().default(false),
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

export const updateRoutineBody = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    time: timeString.optional(),
    category: z.enum(ROUTINE_CATEGORIES).optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    isCompleted: z.boolean().optional(),
    deviceId: deviceId.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const reorderBody = z
  .object({
    // Full or partial ordered list of routine ids; position in the array becomes the new sortOrder.
    ids: z.array(objectId).min(1).max(200),
  })
  .strict()
  .refine((v) => new Set(v.ids).size === v.ids.length, { message: 'ids must be unique', path: ['ids'] });

export const completeBody = z
  .object({ isCompleted: z.boolean().default(true), deviceId: deviceId.optional() })
  .strict();

export const listRoutinesQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  order: z.enum(['asc', 'desc']).default('asc'),
  sort: sortField(['sortOrder', 'time', 'createdAt'] as const, 'sortOrder'),
  category: z.enum(ROUTINE_CATEGORIES).optional(),
  isCompleted: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
