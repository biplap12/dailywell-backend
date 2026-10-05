import { RoutineModel } from './model';

export const routineRepository = {
  async nextSortOrder(userId: string): Promise<number> {
    const last = await RoutineModel.findOne({ userId, deletedAt: null }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    return last ? last.sortOrder + 1 : 0;
  },

  async countOwned(userId: string, ids: string[]): Promise<number> {
    return RoutineModel.countDocuments({ userId, deletedAt: null, _id: { $in: ids } });
  },

  async bulkReorder(userId: string, ids: string[]) {
    return RoutineModel.bulkWrite(
      ids.map((id, index) => ({
        updateOne: {
          // userId in the filter means a foreign id can never be touched even if it slipped past the count check.
          filter: { _id: id, userId, deletedAt: null },
          update: { $set: { sortOrder: index }, $inc: { version: 1 } },
        },
      })),
    );
  },
};
