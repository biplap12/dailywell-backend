import { ValidationError } from '../../common/errors';
import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { ReminderModel } from './model';

export const reminderService = {
  list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; isEnabled?: boolean; repeatType?: string }) {
    const filter: Record<string, unknown> = {};
    if (q.isEnabled !== undefined) filter.isEnabled = q.isEnabled;
    if (q.repeatType) filter.repeatType = q.repeatType;
    return listOwned(ReminderModel, userId, { filter, page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },

  async get(userId: string, id: string) {
    return (await findOwned(ReminderModel, userId, id, 'Reminder')).toJSON();
  },

  async create(userId: string, body: any) {
    return (await createOwned(ReminderModel, userId, { ...body, syncStatus: 'SYNCED' })).toJSON();
  },

  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    const current = await findOwned<any>(ReminderModel, userId, id, 'Reminder');
    const repeatType = rest.repeatType ?? current.repeatType;
    const daysOfWeek = rest.daysOfWeek ?? current.daysOfWeek;
    if ((repeatType === 'WEEKLY' || repeatType === 'CUSTOM') && daysOfWeek.length === 0) {
      throw new ValidationError('daysOfWeek is required for WEEKLY and CUSTOM reminders');
    }
    return (await updateOwned(ReminderModel, userId, id, stripUndefined(rest), 'Reminder', version)).toJSON();
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(ReminderModel, userId, id, 'Reminder');
  },
};
