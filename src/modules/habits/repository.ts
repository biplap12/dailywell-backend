import { HabitCompletionModel, HabitModel } from './model';

export const habitRepository = {
  async nextSortOrder(userId: string): Promise<number> {
    const last = await HabitModel.findOne({ userId, deletedAt: null }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    return last ? last.sortOrder + 1 : 0;
  },

  findCompletion(habitId: string, date: string) {
    return HabitCompletionModel.findOne({ habitId, date }).exec();
  },

  /** Dates (desc) on which the habit was completed, bounded to keep the scan cheap. */
  async completedDates(habitId: string, onOrBefore: string, limit = 400): Promise<string[]> {
    const rows = await HabitCompletionModel.find({ habitId, isCompleted: true, deletedAt: null, date: { $lte: onOrBefore } })
      .sort({ date: -1 })
      .limit(limit)
      .select('date')
      .lean();
    return rows.map((r) => r.date);
  },

  async completedHabitIdsOn(userId: string, date: string): Promise<Set<string>> {
    const rows = await HabitCompletionModel.find({ userId, date, isCompleted: true, deletedAt: null }).select('habitId').lean();
    return new Set(rows.map((r) => r.habitId));
  },

  deleteCompletionsForHabit(habitId: string) {
    return HabitCompletionModel.updateMany({ habitId, deletedAt: null }, { $set: { deletedAt: new Date() }, $inc: { version: 1 } }).exec();
  },
};
