export interface IWaterEntry {
  userId: string;
  localId: string | null;
  clientId: string | null;
  amountMl: number;
  date: string;
  time: string;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyWaterTotal {
  date: string;
  totalMl: number;
  entries: number;
  goalReached: boolean;
}
