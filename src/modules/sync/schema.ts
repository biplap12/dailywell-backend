import { z } from 'zod';
import { SYNC_ENTITY_TYPES, SYNC_OPERATIONS } from '../../common/constants';
import { deviceId, localId, objectId } from '../../common/validators';

const operation = z
  .object({
    entityType: z.enum(SYNC_ENTITY_TYPES),
    operation: z.enum(SYNC_OPERATIONS),
    idempotencyKey: z.string().trim().min(8, 'idempotencyKey must be at least 8 characters').max(200),
    localId: localId.optional(),
    entityId: objectId.optional(),
    baseVersion: z.number().int().min(1).optional(),
    clientUpdatedAt: z.string().datetime({ offset: true }).optional(),
    payload: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((op, ctx) => {
    if (op.operation === 'CREATE') {
      if (!op.localId) ctx.addIssue({ code: 'custom', path: ['localId'], message: 'localId is required for CREATE' });
      if (!op.payload) ctx.addIssue({ code: 'custom', path: ['payload'], message: 'payload is required for CREATE' });
    }
    if (op.operation === 'UPDATE') {
      if (!op.entityId && !op.localId) ctx.addIssue({ code: 'custom', path: ['entityId'], message: 'entityId or localId is required for UPDATE' });
      if (!op.payload) ctx.addIssue({ code: 'custom', path: ['payload'], message: 'payload is required for UPDATE' });
    }
    if (op.operation === 'DELETE' && !op.entityId && !op.localId) {
      ctx.addIssue({ code: 'custom', path: ['entityId'], message: 'entityId or localId is required for DELETE' });
    }
  });

export const uploadBody = z
  .object({
    deviceId,
    operations: z.array(operation).min(1, 'At least one operation is required').max(100, 'At most 100 operations per request'),
    conflictStrategy: z.enum(['LAST_WRITE_WINS', 'SERVER_WINS', 'CLIENT_WINS']).optional(),
  })
  .strict();

export const changesQuery = z.object({
  since: z.string().datetime({ offset: true }),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const migrateGuestBody = z
  .object({
    // Possession of the guest's own refresh token proves the caller owns that guest account.
    guestRefreshToken: z.string().min(20).max(2048),
  })
  .strict();

export type UploadBody = z.infer<typeof uploadBody>;
export { objectId };
