import { z } from 'zod';
import { HOLIDAY_TYPES } from '../../common/constants';
import { dateString, nepaliDateString, paginationQuery } from '../../common/validators';

const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must look like 1.2.3');

export const updateConfigBody = z
  .object({
    maintenanceMode: z.boolean().optional(),
    registrationEnabled: z.boolean().optional(),
    guestAccessEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    offlineModeEnabled: z.boolean().optional(),
    minimumAppVersion: semver.optional(),
    latestAppVersion: semver.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export const holidayQuery = paginationQuery.extend({
  order: z.enum(['asc', 'desc']).default('asc'),
  year: z.string().regex(/^\d{4}$/).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  type: z.enum(HOLIDAY_TYPES).optional(),
  isNational: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const holidayBody = z
  .object({
    titleEn: z.string().trim().min(1).max(200),
    titleNe: z.string().trim().min(1).max(200),
    dateGregorian: dateString,
    dateNepali: nepaliDateString,
    type: z.enum(HOLIDAY_TYPES).default('PUBLIC'),
    isNational: z.boolean().default(true),
    description: z.string().trim().max(1000).default(''),
  })
  .strict();

export const holidayUpdateBody = holidayBody.partial().strict().refine((v) => Object.keys(v).length > 0, 'At least one field is required');
