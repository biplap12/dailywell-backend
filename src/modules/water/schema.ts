import { z } from 'zod';
import { dateString, deviceId, localId, paginationQuery, sortField, timeString } from '../../common/validators';

export const createWaterBody = z
  .object({
    amountMl: z.number().int().min(1).max(5000),
    date: dateString,
    time: timeString,
    localId: localId.optional(),
    deviceId: deviceId.optional(),
  })
  .strict();

/** Used by the sync engine for UPDATE operations. */
export const updateWaterBody = z
  .object({
    amountMl: z.number().int().min(1).max(5000).optional(),
    date: dateString.optional(),
    time: timeString.optional(),
    deviceId: deviceId.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict();

export const listWaterQuery = paginationQuery
  .extend({
    sort: sortField(['date', 'createdAt', 'amountMl'] as const, 'date'),
    date: dateString.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '`from` must not be after `to`', path: ['from'] });
