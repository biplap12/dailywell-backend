import type { FilterQuery } from 'mongoose';
import { WaterModel } from './model';
import type { DailyWaterTotal } from './types';

export const waterRepository = {
  dateFilter(q: { date?: string; from?: string; to?: string }): FilterQuery<any> {
    if (q.date) return { date: q.date };
    if (q.from || q.to) return { date: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } };
    return {};
  },

  async dailyTotals(userId: string, from: string, to: string, goalMl: number): Promise<DailyWaterTotal[]> {
    const rows = await WaterModel.aggregate<{ _id: string; totalMl: number; entries: number }>([
      { $match: { userId, deletedAt: null, date: { $gte: from, $lte: to } } },
      { $group: { _id: '$date', totalMl: { $sum: '$amountMl' }, entries: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    return rows.map((r) => ({ date: r._id, totalMl: r.totalMl, entries: r.entries, goalReached: r.totalMl >= goalMl }));
  },
};
