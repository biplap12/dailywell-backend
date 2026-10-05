export interface IActivityLog {
  userId: string;
  localId: string | null;
  clientId: string | null;
  activityType: string;
  durationMinutes: number;
  date: string;
  time: string;
  notes: string;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
