export type RepeatType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';

export interface IReminder {
  userId: string;
  localId: string | null;
  clientId: string | null;
  title: string;
  description: string;
  time: string;
  repeatType: RepeatType;
  /** 0 (Sunday) - 6 (Saturday). Used by WEEKLY and CUSTOM reminders. */
  daysOfWeek: number[];
  isEnabled: boolean;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
