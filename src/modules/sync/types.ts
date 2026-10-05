import type { SyncEntityType, SyncOperationType } from '../../common/constants';

export type ConflictStrategyName = 'LAST_WRITE_WINS' | 'SERVER_WINS' | 'CLIENT_WINS';
export type ConflictResolution = 'CLIENT_WINS' | 'SERVER_WINS';

export interface SyncOperationInput {
  entityType: SyncEntityType;
  operation: SyncOperationType;
  idempotencyKey: string;
  /** Client-generated id of the row (required for CREATE, used to find the row for UPDATE/DELETE) */
  localId?: string;
  /** Server id; preferred over localId for UPDATE/DELETE once the client knows it */
  entityId?: string;
  /** The server `version` the client based its edit on */
  baseVersion?: number;
  /** When the user made the change on the device (ISO). Drives last-write-wins. */
  clientUpdatedAt?: string;
  payload?: Record<string, unknown>;
}

export type OperationStatus = 'PROCESSED' | 'DUPLICATE' | 'CONFLICT' | 'FAILED';

export interface ConflictInfo {
  entityType: SyncEntityType;
  entityId: string;
  clientVersion: number | null;
  serverVersion: number;
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolution: ConflictResolution;
  strategy: ConflictStrategyName;
}

export interface IdMapping {
  entityType: SyncEntityType;
  localId: string;
  serverId: string;
}

export interface ChangeRecord {
  entityType: SyncEntityType;
  entityId: string;
  localId: string | null;
  operation: SyncOperationType;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface OperationResult {
  idempotencyKey: string;
  entityType: SyncEntityType;
  operation: SyncOperationType;
  status: OperationStatus;
  entityId?: string;
  localId?: string;
  version?: number;
  idMapping?: IdMapping;
  change?: ChangeRecord;
  conflict?: ConflictInfo;
  error?: { code: string; message: string; details?: unknown };
  /** True when this result was replayed from a previously processed idempotency key */
  replayed?: boolean;
}

export interface SyncSummary {
  processed: number;
  failed: number;
  conflicts: number;
  duplicates: number;
  idMappings: IdMapping[];
  changes: ChangeRecord[];
  conflictDetails: ConflictInfo[];
  results: OperationResult[];
}

export interface ISyncOperation {
  userId: string;
  deviceId: string;
  idempotencyKey: string;
  entityType: string;
  operation: string;
  localId: string | null;
  entityId: string | null;
  state: 'PROCESSING' | 'DONE';
  result: OperationResult | null;
  processedAt: Date | null;
  createdAt: Date;
}
