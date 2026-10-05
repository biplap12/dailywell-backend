import { z } from 'zod';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from '../../common/constants';
import { paginationQuery, sortField } from '../../common/validators';

export const listNotificationsQuery = paginationQuery.extend({
  sort: sortField(['createdAt', 'priority'] as const, 'createdAt'),
  isRead: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
});

/** Used by admin tooling to send a notification to a specific user. */
export const createNotificationBody = z
  .object({
    userId: z.string().regex(/^[a-fA-F0-9]{24}$/),
    titleEn: z.string().trim().min(1).max(200),
    titleNe: z.string().trim().min(1).max(200),
    messageEn: z.string().trim().min(1).max(2000),
    messageNe: z.string().trim().min(1).max(2000),
    category: z.enum(NOTIFICATION_CATEGORIES).default('SYSTEM'),
    priority: z.enum(NOTIFICATION_PRIORITIES).default('NORMAL'),
    actionType: z.string().trim().max(60).nullable().optional(),
  })
  .strict();
