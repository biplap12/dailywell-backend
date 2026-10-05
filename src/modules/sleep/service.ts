import { ValidationError } from '../../common/errors';
import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { SleepModel } from './model';
import { sleepRepository } from './repository';

function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function assertDuration(start: Date, end: Date, claimed?: number): number {
  const computed = minutesBetween(start, end);
  if (computed < 1 || computed > 1440) throw new ValidationError('Sleep duration must be between 1 minute and 24 hours');
  // The server derives duration from the timestamps; a conflicting client claim is rejected.
  if (claimed !== undefined && Math.abs(claimed - computed) > 1) {
    throw new ValidationError('durationMinutes does not match startTime/endTime', { claimed, computed });
  }
  return computed;
}

export const sleepService = {
  list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; date?: string; from?: string; to?: string }) {
    return listOwned(SleepModel, userId, { filter: sleepRepository.dateFilter(q), page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },

  async get(userId: string, id: string) {
    return (await findOwned(SleepModel, userId, id, 'Sleep entry')).toJSON();
  },

  async create(userId: string, body: any) {
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    const durationMinutes = assertDuration(start, end, body.durationMinutes);
    const doc = await createOwned(SleepModel, userId, { ...body, startTime: start, endTime: end, durationMinutes, syncStatus: 'SYNCED' });
    return doc.toJSON();
  },

  async update(userId: string, id: string, body: any) {
    const current = await findOwned<any>(SleepModel, userId, id, 'Sleep entry');
    const { version, durationMinutes: claimed, ...rest } = body;
    const start = rest.startTime ? new Date(rest.startTime) : current.startTime;
    const end = rest.endTime ? new Date(rest.endTime) : current.endTime;
    const durationMinutes = assertDuration(start, end, claimed);
    const patch = stripUndefined({ ...rest, startTime: start, endTime: end, durationMinutes });
    return (await updateOwned(SleepModel, userId, id, patch, 'Sleep entry', version)).toJSON();
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(SleepModel, userId, id, 'Sleep entry');
  },
};
