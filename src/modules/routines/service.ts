import { NotFoundError } from '../../common/errors';
import { createOwned, findOwned, listOwned, softDeleteOwned, stripUndefined, updateOwned } from '../../common/utils/ownedCrud';
import { RoutineModel } from './model';
import { routineRepository } from './repository';

export const routineService = {
  list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; category?: string; isCompleted?: boolean }) {
    const filter: Record<string, unknown> = {};
    if (q.category) filter.category = q.category;
    if (q.isCompleted !== undefined) filter.isCompleted = q.isCompleted;
    return listOwned(RoutineModel, userId, { filter, page: q.page, limit: q.limit, sort: q.sort, order: q.order });
  },

  async get(userId: string, id: string) {
    return (await findOwned(RoutineModel, userId, id, 'Routine')).toJSON();
  },

  async create(userId: string, body: any) {
    const sortOrder = body.sortOrder ?? (await routineRepository.nextSortOrder(userId));
    return (await createOwned(RoutineModel, userId, { ...body, sortOrder, syncStatus: 'SYNCED' })).toJSON();
  },

  async update(userId: string, id: string, body: any) {
    const { version, ...rest } = body;
    return (await updateOwned(RoutineModel, userId, id, stripUndefined(rest), 'Routine', version)).toJSON();
  },

  async complete(userId: string, id: string, body: { isCompleted: boolean; deviceId?: string }) {
    return (await updateOwned(RoutineModel, userId, id, stripUndefined({ isCompleted: body.isCompleted, deviceId: body.deviceId }), 'Routine')).toJSON();
  },

  async reorder(userId: string, ids: string[]) {
    const owned = await routineRepository.countOwned(userId, ids);
    if (owned !== ids.length) throw new NotFoundError('One or more routines were not found');
    await routineRepository.bulkReorder(userId, ids);
    return listOwned(RoutineModel, userId, { page: 1, limit: 100, sort: 'sortOrder', order: 'asc' });
  },

  async remove(userId: string, id: string) {
    await softDeleteOwned(RoutineModel, userId, id, 'Routine');
  },
};
