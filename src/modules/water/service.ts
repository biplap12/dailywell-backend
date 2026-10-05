import { createOwned, findOwned, listOwned, softDeleteOwned } from '../../common/utils/ownedCrud';
import { userRepository } from '../users/repository';
import { WaterModel } from './model';
import { waterRepository } from './repository';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export const waterService = {
  async list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; date?: string; from?: string; to?: string }) {
    const list = await listOwned(WaterModel, userId, {
      filter: waterRepository.dateFilter(q),
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });

    const user = await userRepository.findById(userId);
    const goalMl = user?.waterGoalMl ?? 2500;
    // Daily totals cover the requested window; default to the last 7 days.
    const from = q.date ?? q.from ?? isoDaysAgo(6);
    const to = q.date ?? q.to ?? isoDaysAgo(0);
    const dailyTotals = await waterRepository.dailyTotals(userId, from, to, goalMl);

    return { ...list, summary: { goalMl, from, to, dailyTotals } };
  },

  async get(userId: string, id: string) {
    return (await findOwned(WaterModel, userId, id, 'Water entry')).toJSON();
  },

  async create(userId: string, body: Record<string, unknown>) {
    return (await createOwned(WaterModel, userId, { ...body, syncStatus: 'SYNCED' })).toJSON();
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(WaterModel, userId, id, 'Water entry');
  },
};
