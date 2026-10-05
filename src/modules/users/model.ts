import { Schema, model, type HydratedDocument } from 'mongoose';
import { ROLES } from '../../common/constants';
import { applyJsonTransform } from '../../common/utils/mongoose';
import type { IUser } from './types';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    // Guests have no email/phone; sparse unique index keeps real emails unique.
    email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, default: null, trim: true, maxlength: 30 },
    passwordHash: { type: String, default: null, select: false },
    role: { type: String, enum: ROLES, default: 'USER' },
    waterGoalMl: { type: Number, default: 2500, min: 500, max: 10000 },
    sleepTargetMinutes: { type: Number, default: 480, min: 60, max: 1080 },
    stepGoal: { type: Number, default: 8000, min: 1000, max: 100000 },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    migratedToUserId: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

applyJsonTransform(userSchema, ['passwordHash']);

export type UserDocument = HydratedDocument<IUser>;
export const UserModel = model<IUser>('User', userSchema);
