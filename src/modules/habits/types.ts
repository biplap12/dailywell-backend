export interface IHabit {
  userId: string;
  localId: string | null;
  clientId: string | null;
  name: string;
  description: string;
  reminderTime: string | null;
  colorHex: string;
  streakCount: number;
  sortOrder: number;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}

export interface IHabitCompletion {
  userId: string;
  habitId: string;
  localId: string | null;
  clientId: string | null;
  date: string;
  isCompleted: boolean;
  completedAt: Date | null;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
