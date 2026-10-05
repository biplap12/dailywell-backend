export interface IStepRecord {
  userId: string;
  localId: string | null;
  clientId: string | null;
  date: string;
  steps: number;
  goal: number;
  distanceMeters: number;
  caloriesKcal: number;
  activeMinutes: number;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertStatus = 'created' | 'updated' | 'conflict';

export interface StepConflict {
  entityType: 'steps';
  entityId: string;
  date: string;
  clientVersion: number | null;
  serverVersion: number;
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolution: 'SERVER_WINS' | 'CLIENT_WINS';
}
