import { findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { userRepository } from '../users/repository';
import { StepModel } from './model';
import { stepRepository } from './repository';
import type { StepConflict, UpsertStatus } from './types';

export interface StepInput {
  date: string;
  steps: number;
  goal?: number;
  distanceMeters?: number;
  caloriesKcal?: number;
  activeMinutes?: number;
  localId?: string;
  deviceId?: string;
  /** Client modification time (ISO). When older than the server copy, the server copy wins. */
  updatedAt?: string;
  version?: number;
}

export const stepService = {
  /**
   * Insert-or-update the single record for (userId, date).
   * Safe to retry: repeating the same payload never creates a second row.
   */
  async upsertDay(userId: string, input: StepInput, defaultGoal: number): Promise<{ status: UpsertStatus; record: any; conflict?: StepConflict }> {
    const fields = stripUndefined({
      steps: input.steps,
      goal: input.goal ?? defaultGoal,
      distanceMeters: input.distanceMeters,
      caloriesKcal: input.caloriesKcal,
      activeMinutes: input.activeMinutes,
      deviceId: input.deviceId,
      localId: input.localId,
      syncStatus: 'SYNCED',
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await stepRepository.findByDate(userId, input.date);

      if (!existing) {
        try {
          const created = await StepModel.create({ ...fields, userId, date: input.date, version: 1, deletedAt: null });
          return { status: 'created', record: created.toJSON() };
        } catch (err) {
          if ((err as { code?: number }).code === 11000 && attempt === 0) continue; // concurrent insert, retry as update
          throw err;
        }
      }

      const clientTime = input.updatedAt ? new Date(input.updatedAt).getTime() : undefined;
      const serverNewer = clientTime !== undefined && existing.updatedAt.getTime() > clientTime && !existing.deletedAt;
      if (serverNewer) {
        // Never silently overwrite: report what was ignored.
        return {
          status: 'conflict',
          record: existing.toJSON(),
          conflict: {
            entityType: 'steps',
            entityId: String(existing._id),
            date: input.date,
            clientVersion: input.version ?? null,
            serverVersion: existing.version,
            clientData: { ...fields, date: input.date, updatedAt: input.updatedAt },
            serverData: existing.toJSON() as unknown as Record<string, unknown>,
            resolution: 'SERVER_WINS',
          },
        };
      }

      existing.set({ ...fields, deletedAt: null });
      existing.version += 1;
      await existing.save();
      return { status: 'updated', record: existing.toJSON() };
    }
    throw new Error('Unreachable');
  },

  async list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; date?: string; from?: string; to?: string }) {
    return listOwned(StepModel, userId, { filter: stepRepository.dateFilter(q), page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },

  async get(userId: string, id: string) {
    return (await findOwned(StepModel, userId, id, 'Step record')).toJSON();
  },

  async create(userId: string, body: StepInput) {
    const user = await userRepository.findById(userId);
    const { record } = await stepService.upsertDay(userId, body, user?.stepGoal ?? 8000);
    return record;
  },

  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    return (await updateOwned(StepModel, userId, id, stripUndefined(rest), 'Step record', version)).toJSON();
  },

  async batch(userId: string, body: { deviceId?: string; records: StepInput[] }) {
    const user = await userRepository.findById(userId);
    const goal = user?.stepGoal ?? 8000;
    const out = { processed: 0, created: 0, updated: 0, conflicts: [] as StepConflict[], items: [] as unknown[] };
    for (const rec of body.records) {
      const { status, record, conflict } = await stepService.upsertDay(userId, { ...rec, deviceId: body.deviceId }, goal);
      out.processed += 1;
      out.items.push(record);
      if (status === 'created') out.created += 1;
      else if (status === 'updated') out.updated += 1;
      else if (conflict) out.conflicts.push(conflict);
    }
    return out;
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(StepModel, userId, id, 'Step record');
  },
};
