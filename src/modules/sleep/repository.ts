import type { FilterQuery } from 'mongoose';

export const sleepRepository = {
  dateFilter(q: { date?: string; from?: string; to?: string }): FilterQuery<any> {
    if (q.date) return { date: q.date };
    if (q.from || q.to) return { date: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } };
    return {};
  },
};
