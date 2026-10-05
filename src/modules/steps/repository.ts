import type { FilterQuery } from 'mongoose';
import { StepModel } from './model';

export const stepRepository = {
  dateFilter(q: { date?: string; from?: string; to?: string }): FilterQuery<any> {
    if (q.date) return { date: q.date };
    if (q.from || q.to) return { date: { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) } };
    return {};
  },

  /** Includes soft-deleted rows: the unique (userId, date) index still applies to them. */
  findByDate(userId: string, date: string) {
    return StepModel.findOne({ userId, date }).exec();
  },
};
