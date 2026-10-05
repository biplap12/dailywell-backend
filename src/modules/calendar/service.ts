import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { CalendarModel } from './model';
import { calendarRepository } from './repository';

export const calendarService = {
  list(userId: string, q: any) {
    return listOwned(CalendarModel, userId, { filter: calendarRepository.buildFilter(q), page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },
  async get(userId: string, id: string) {
    return (await findOwned(CalendarModel, userId, id, 'Calendar event')).toJSON();
  },
  async create(userId: string, body: any) {
    return (await createOwned(CalendarModel, userId, { ...body, syncStatus: 'SYNCED' })).toJSON();
  },
  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    return (await updateOwned(CalendarModel, userId, id, stripUndefined(rest), 'Calendar event', version)).toJSON();
  },
  async remove(userId: string, id: string) {
    await softDeleteOwned(CalendarModel, userId, id, 'Calendar event');
  },
};
