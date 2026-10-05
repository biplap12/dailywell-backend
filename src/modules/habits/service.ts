import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { HabitCompletionModel, HabitModel } from './model';
import { habitRepository } from './repository';

const todayUtc = () => new Date().toISOString().slice(0, 10);

function prevDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Consecutive completed days ending at `reference` (or the day before, if today is not done yet). */
export function computeStreak(completedDesc: string[], reference: string): number {
  const set = new Set(completedDesc);
  let cursor = set.has(reference) ? reference : prevDay(reference);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = prevDay(cursor);
  }
  return streak;
}

export const habitService = {
  /** Recompute and persist streak. Exposed so the sync engine can reuse it. */
  async refreshStreak(habitId: string, userId: string, reference = todayUtc()) {
    const dates = await habitRepository.completedDates(habitId, reference);
    const streakCount = computeStreak(dates, reference);
    await HabitModel.updateOne({ _id: habitId, userId, deletedAt: null }, { $set: { streakCount }, $inc: { version: 1 } });
    return streakCount;
  },

  async list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; date?: string }) {
    const result = await listOwned(HabitModel, userId, { page: q.page, limit: q.limit, sort: q.sort, order: q.order });
    const date = q.date ?? todayUtc();
    const done = await habitRepository.completedHabitIdsOn(userId, date);
    const items = result.items.map((h: any) => ({ ...h, isCompletedOnDate: done.has(h.id), date }));
    return { ...result, items };
  },

  async get(userId: string, id: string) {
    return (await findOwned(HabitModel, userId, id, 'Habit')).toJSON();
  },

  async create(userId: string, body: any) {
    const sortOrder = body.sortOrder ?? (await habitRepository.nextSortOrder(userId));
    return (await createOwned(HabitModel, userId, { ...body, sortOrder, streakCount: 0, syncStatus: 'SYNCED' })).toJSON();
  },

  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    return (await updateOwned(HabitModel, userId, id, stripUndefined(rest), 'Habit', version)).toJSON();
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(HabitModel, userId, id, 'Habit');
    await habitRepository.deleteCompletionsForHabit(id);
  },

  /** Marks the habit done for a date, or undoes it. At most one completion row exists per habit/date. */
  async toggle(userId: string, habitId: string, body: { date?: string; isCompleted?: boolean; deviceId?: string }) {
    await findOwned(HabitModel, userId, habitId, 'Habit'); // ownership check
    const date = body.date ?? todayUtc();

    const apply = async () => {
      const existing = await habitRepository.findCompletion(habitId, date);
      if (existing) {
        const next = body.isCompleted ?? !(existing.isCompleted && !existing.deletedAt);
        existing.isCompleted = next;
        existing.completedAt = next ? new Date() : null;
        existing.deletedAt = null;
        existing.version += 1;
        if (body.deviceId) existing.deviceId = body.deviceId;
        await existing.save();
        return existing;
      }
      return HabitCompletionModel.create({
        userId,
        habitId,
        date,
        isCompleted: body.isCompleted ?? true,
        completedAt: body.isCompleted === false ? null : new Date(),
        deviceId: body.deviceId ?? null,
        version: 1,
      });
    };

    let completion;
    try {
      completion = await apply();
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      completion = await apply(); // lost a race with a concurrent toggle; retry against the row that now exists
    }

    // Streak is always the *current* streak (as of today), even when a past day is toggled.
    const streakCount = await habitService.refreshStreak(habitId, userId);
    return { habitId, date, isCompleted: completion.isCompleted, completedAt: completion.completedAt, streakCount };
  },
};
