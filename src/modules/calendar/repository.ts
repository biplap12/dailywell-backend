import type { FilterQuery } from 'mongoose';

type Range = { $gte?: string; $lte?: string };

function range(from?: string, to?: string): Range {
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
}

export const calendarRepository = {
  buildFilter(q: { date?: string; from?: string; to?: string; nepaliDate?: string; nepaliFrom?: string; nepaliTo?: string; category?: string }): FilterQuery<any> {
    const f: FilterQuery<any> = {};
    if (q.date) f.dateGregorian = q.date;
    else if (q.from || q.to) f.dateGregorian = range(q.from, q.to);
    if (q.nepaliDate) f.dateNepali = q.nepaliDate;
    else if (q.nepaliFrom || q.nepaliTo) f.dateNepali = range(q.nepaliFrom, q.nepaliTo);
    if (q.category) f.category = q.category;
    return f;
  },
};
