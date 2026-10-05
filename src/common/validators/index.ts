import { Types } from 'mongoose';
import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants';

export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v) && /^[a-fA-F0-9]{24}$/.test(v), { message: 'Invalid ObjectId' });

export const idParams = z.object({ id: objectId });

/** YYYY-MM-DD with real calendar validation */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid calendar date');

/** HH:mm, 24-hour */
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24h)');

export const hexColor = z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex value');

export const deviceId = z.string().trim().min(1).max(128);
export const localId = z.string().trim().min(1).max(128);

/** Nepali (Bikram Sambat) date, e.g. 2083-06-18 */
export const nepaliDateString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[0-2])$/, 'Nepali date must be YYYY-MM-DD (BS)');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export function sortField<T extends readonly [string, ...string[]]>(fields: T, fallback: T[number]) {
  return z.enum(fields).default(fallback);
}

export const dateRangeQuery = z.object({
  date: dateString.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

/** Optional sync metadata clients may send with writes. */
export const syncMeta = z.object({
  localId: localId.optional(),
  deviceId: deviceId.optional(),
});

export const bearerHeader = z
  .object({ authorization: z.string().regex(/^Bearer\s+\S+$/i, 'Authorization must be a Bearer token') })
  .passthrough();
