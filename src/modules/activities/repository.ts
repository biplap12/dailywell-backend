import type { FilterQuery } from 'mongoose';

export const activityRepository = {
  buildFilter(q: { date?: string; from?: string; to?: string; activityType?: string }): FilterQuery<any> {
    const f: FilterQuery<any> = {};
    if (q.date) f.date = q.date;
    else if (q.from || q.to) f.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    if (q.activityType) f.activityType = q.activityType;
    return f;
  },
};
