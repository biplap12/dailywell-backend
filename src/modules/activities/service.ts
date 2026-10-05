import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { ActivityModel } from './model';
import { activityRepository } from './repository';

export const activityService = {
  list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; date?: string; from?: string; to?: string; activityType?: string }) {
    return listOwned(ActivityModel, userId, { filter: activityRepository.buildFilter(q), page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },
  async get(userId: string, id: string) {
    return (await findOwned(ActivityModel, userId, id, 'Activity')).toJSON();
  },
  async create(userId: string, body: any) {
    return (await createOwned(ActivityModel, userId, { ...body, syncStatus: 'SYNCED' })).toJSON();
  },
  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    return (await updateOwned(ActivityModel, userId, id, stripUndefined(rest), 'Activity', version)).toJSON();
  },
  async remove(userId: string, id: string) {
    await softDeleteOwned(ActivityModel, userId, id, 'Activity');
  },
};
