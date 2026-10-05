import { z } from 'zod';
import { ROLES } from '../../common/constants';
import { paginationQuery, sortField } from '../../common/validators';

export const listUsersQuery = paginationQuery.extend({
  sort: sortField(['createdAt', 'lastLoginAt', 'name', 'email'] as const, 'createdAt'),
  role: z.enum(ROLES).optional(),
  isSuspended: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const suspendBody = z.object({ isSuspended: z.boolean() }).strict();

export const roleBody = z.object({ role: z.enum(['ADMIN', 'USER']) }).strict();

export const auditQuery = paginationQuery.extend({
  action: z.string().trim().min(1).max(80).optional(),
  actorId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});
