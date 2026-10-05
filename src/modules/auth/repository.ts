import { SessionModel } from './model';
import type { ISession } from './types';

export const sessionRepository = {
  create(data: Omit<ISession, '_id' | 'createdAt' | 'revokedAt' | 'replacedByJti'>) {
    return SessionModel.create({ ...data, revokedAt: null, replacedByJti: null });
  },

  findByJti(jti: string) {
    return SessionModel.findOne({ jti }).exec();
  },

  /** Atomically revokes a token only if it is still active; returns null if someone else already used it. */
  async revokeIfActive(jti: string, replacedByJti: string | null) {
    return SessionModel.findOneAndUpdate(
      { jti, revokedAt: null },
      { $set: { revokedAt: new Date(), replacedByJti } },
      { new: true },
    ).exec();
  },

  revokeFamily(familyId: string) {
    return SessionModel.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
  },

  revokeAllForUser(userId: string) {
    return SessionModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
  },
};
