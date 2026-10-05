import { z } from 'zod';
import { dateString, deviceId, hexColor, localId, nepaliDateString, paginationQuery, sortField, timeString } from '../../common/validators';

const base = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  // Clients may send either calendar (or both). The server does not convert between them.
  dateGregorian: dateString.optional(),
  dateNepali: nepaliDateString.optional(),
  time: timeString.nullable().optional(),
  category: z.string().trim().min(1).max(50).default('GENERAL'),
  colorHex: hexColor.default('#2196F3'),
  localId: localId.optional(),
  deviceId: deviceId.optional(),
});

export const createEventBody = base
  .strict()
  .refine((v) => v.dateGregorian || v.dateNepali, { message: 'Provide dateGregorian or dateNepali', path: ['dateGregorian'] });

export const updateEventBody = base
  .omit({ localId: true })
  .partial()
  .extend({ version: z.number().int().min(1).optional() })
  .strict();

export const listEventsQuery = paginationQuery.extend({
  sort: sortField(['dateGregorian', 'dateNepali', 'createdAt', 'time'] as const, 'dateGregorian'),
  order: z.enum(['asc', 'desc']).default('asc'),
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  nepaliDate: nepaliDateString.optional(),
  nepaliFrom: nepaliDateString.optional(),
  nepaliTo: nepaliDateString.optional(),
  category: z.string().trim().min(1).max(50).optional(),
});
