import { HolidayModel, RemoteConfigModel } from './model';

export const configRepository = {
  /** Upserts the default document so a fresh database always has a config. */
  getOrCreate() {
    return RemoteConfigModel.findOneAndUpdate(
      { key: 'app' },
      { $setOnInsert: { key: 'app' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  },

  update(patch: Record<string, unknown>) {
    return RemoteConfigModel.findOneAndUpdate(
      { key: 'app' },
      { $set: patch },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  },

  async listHolidays(filter: { year?: string; type?: string; from?: string; to?: string; isNational?: boolean }, skip: number, limit: number, order: 1 | -1) {
    const q: Record<string, unknown> = {};
    if (filter.type) q.type = filter.type;
    if (filter.isNational !== undefined) q.isNational = filter.isNational;
    if (filter.year) q.dateGregorian = { $gte: `${filter.year}-01-01`, $lte: `${filter.year}-12-31` };
    if (filter.from || filter.to) {
      q.dateGregorian = { ...(q.dateGregorian as object), ...(filter.from ? { $gte: filter.from } : {}), ...(filter.to ? { $lte: filter.to } : {}) };
    }
    const [items, total] = await Promise.all([
      HolidayModel.find(q).sort({ dateGregorian: order }).skip(skip).limit(limit).exec(),
      HolidayModel.countDocuments(q).exec(),
    ]);
    return { items, total };
  },

  createHoliday(data: Record<string, unknown>) {
    return HolidayModel.create(data);
  },

  updateHoliday(id: string, patch: Record<string, unknown>) {
    return HolidayModel.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).exec();
  },

  deleteHoliday(id: string) {
    return HolidayModel.findByIdAndDelete(id).exec();
  },
};
