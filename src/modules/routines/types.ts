export type RoutineCategory = 'MORNING' | 'HEALTH' | 'WORK' | 'STUDY' | 'EXERCISE' | 'EVENING' | 'SLEEP' | 'CUSTOM';

export interface IRoutineItem {
  userId: string;
  localId: string | null;
  clientId: string | null;
  title: string;
  time: string;
  sortOrder: number;
  category: RoutineCategory;
  isCompleted: boolean;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
