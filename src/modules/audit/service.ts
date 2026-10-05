import { logger } from '../../common/utils/logger';
import { AuditLogModel } from './model';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const auditService = {
  /** Audit writes must never break the request that triggered them. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await AuditLogModel.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        ip: entry.ip ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, action: entry.action }, 'Failed to write audit log');
    }
  },

  async list(skip: number, limit: number, filter: { action?: string; actorId?: string } = {}) {
    const query: Record<string, string> = {};
    if (filter.action) query.action = filter.action;
    if (filter.actorId) query.actorId = filter.actorId;
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(query),
    ]);
    return { items, total };
  },
};
