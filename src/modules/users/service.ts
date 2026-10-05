import { NotFoundError } from '../../common/errors';
import { userRepository } from './repository';
import type { UserDocument } from './model';
import type { PublicUser } from './types';

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    waterGoalMl: user.waterGoalMl,
    sleepTargetMinutes: user.sleepTargetMinutes,
    stepGoal: user.stepGoal,
    isActive: user.isActive,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export const userService = {
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async updateStepGoal(userId: string, stepGoal: number): Promise<PublicUser> {
    const user = await userRepository.updateById(userId, { stepGoal });
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  /** Only whitelisted fields are ever written; role/email/password cannot be changed here. */
  async updateSettings(
    userId: string,
    patch: Partial<Pick<PublicUser, 'waterGoalMl' | 'sleepTargetMinutes' | 'stepGoal' | 'name' | 'phone'>>,
  ): Promise<PublicUser> {
    const user = await userRepository.updateById(userId, patch);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },
};
