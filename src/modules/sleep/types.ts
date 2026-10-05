export interface ISleepEntry {
  userId: string;
  localId: string | null;
  clientId: string | null;
  date: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  qualityScore: number;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
