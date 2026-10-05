import type { Role } from '../../common/constants';

export interface IUser {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  role: Role;
  waterGoalMl: number;
  sleepTargetMinutes: number;
  stepGoal: number;
  isActive: boolean;
  isSuspended: boolean;
  migratedToUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  waterGoalMl: number;
  sleepTargetMinutes: number;
  stepGoal: number;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}
