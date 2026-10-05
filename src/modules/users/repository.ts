import { UserModel, type UserDocument } from './model';
import type { Role } from '../../common/constants';

export const userRepository = {
  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  },

  findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).exec();
  },

  /** Includes passwordHash (normally select:false) for credential checks only. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  },

  create(data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    passwordHash?: string | null;
    role?: Role;
  }): Promise<UserDocument> {
    return UserModel.create(data);
  },

  updateById(id: string, patch: Record<string, unknown>): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).exec();
  },

  touchLogin(id: string): Promise<unknown> {
    return UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  },

  async list(filter: { role?: Role; isSuspended?: boolean }, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const query: Record<string, unknown> = {};
    if (filter.role) query.role = filter.role;
    if (filter.isSuspended !== undefined) query.isSuspended = filter.isSuspended;
    const [items, total] = await Promise.all([
      UserModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      UserModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  },
};
