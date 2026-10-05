import { AuthenticationError, AuthorizationError, ConflictError } from '../../common/errors';
import { SYNC_ENTITY_TYPES, type SyncEntityType } from '../../common/constants';
import { sha256 } from '../../common/utils/crypto';
import { verifyRefreshToken } from '../../common/utils/jwt';
import { auditService } from '../audit/service';
import { SessionModel } from '../auth/model';
import { sessionRepository } from '../auth/repository';
import { UserModel } from '../users/model';
import { adapters } from './adapters';

export interface MigrationSummary {
  guestUserId: string;
  alreadyMigrated: boolean;
  entities: Record<string, { migrated: number; skipped: number }>;
}

/**
 * Moves everything a guest account owns on the server to the authenticated account.
 *
 * Security model:
 *  - the destination is ALWAYS the caller (taken from the JWT, never from the body);
 *  - the source is proven by presenting that guest's own valid, unrevoked refresh token,
 *    so knowing or guessing another user's id is worthless;
 *  - the source must be a GUEST account, so real accounts can never be absorbed;
 *  - a guest can be migrated into exactly one account, once.
 */
export async function migrateGuest(targetUserId: string, guestRefreshToken: string, ip?: string | null): Promise<MigrationSummary> {
  const payload = verifyRefreshToken(guestRefreshToken);
  const session = await sessionRepository.findByJti(payload.jti);
  if (!session || session.tokenHash !== sha256(guestRefreshToken) || session.userId !== payload.sub) {
    throw new AuthenticationError('Invalid guest token', 'INVALID_TOKEN');
  }

  const guest = await UserModel.findById(payload.sub).exec();
  if (!guest || guest.role !== 'GUEST') throw new AuthorizationError('Only guest accounts can be migrated');
  const guestId = String(guest._id);
  if (guestId === targetUserId) throw new AuthorizationError('Cannot migrate an account into itself');

  if (guest.migratedToUserId) {
    if (guest.migratedToUserId === targetUserId) return { guestUserId: guestId, alreadyMigrated: true, entities: {} };
    throw new ConflictError('This guest account was already migrated to a different account');
  }
  if (session.revokedAt) throw new AuthenticationError('Guest session has been revoked', 'INVALID_TOKEN');

  // Claim the guest atomically so two concurrent migrations cannot both proceed.
  const claimed = await UserModel.findOneAndUpdate(
    { _id: guestId, role: 'GUEST', migratedToUserId: null },
    { $set: { migratedToUserId: targetUserId } },
  ).exec();
  if (!claimed) throw new ConflictError('This guest account is already being migrated');

  const entities: MigrationSummary['entities'] = {};

  for (const type of SYNC_ENTITY_TYPES as readonly SyncEntityType[]) {
    const { model } = adapters[type];
    let migrated = 0;
    let skipped = 0;
    const cursor = model.find({ userId: guestId }).cursor();
    for await (const doc of cursor) {
      try {
        await model.updateOne(
          { _id: doc._id, userId: guestId },
          { $set: { userId: targetUserId, syncStatus: 'SYNCED' }, $inc: { version: 1 } },
        );
        migrated += 1;
      } catch (err) {
        // The destination already has this row (same localId from the same device, or the
        // same day of steps). Keep the destination's copy and leave the guest's behind.
        if ((err as { code?: number }).code === 11000) skipped += 1;
        else throw err;
      }
    }
    entities[type] = { migrated, skipped };
  }

  // The guest identity is finished: no further logins, no live sessions.
  await UserModel.updateOne({ _id: guestId }, { $set: { isActive: false } });
  await sessionRepository.revokeAllForUser(guestId);
  await SessionModel.updateMany({ userId: guestId }, { $set: { revokedAt: new Date() } });

  await auditService.record({
    actorId: targetUserId,
    action: 'GUEST_MIGRATED',
    entityType: 'user',
    entityId: guestId,
    ip,
    metadata: { entities },
  });

  return { guestUserId: guestId, alreadyMigrated: false, entities };
}
