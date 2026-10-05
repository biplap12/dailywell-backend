import { NotFoundError } from '../../common/errors';
import { listOwned } from '../../common/utils/ownedCrud';
import { NotificationModel } from './model';
import { notificationRepository } from './repository';
import type { CreateNotificationInput } from './types';

export const notificationService = {
  async list(userId: string, q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; isRead?: boolean; category?: string }) {
    const filter: Record<string, unknown> = {};
    if (q.isRead !== undefined) filter.isRead = q.isRead;
    if (q.category) filter.category = q.category;
    // Notifications are hard-deleted, so they carry no deletedAt; listOwned's `deletedAt: null`
    // matches documents where the field is missing.
    const list = await listOwned(NotificationModel, userId, { filter, page: q.page, limit: q.limit, sort: q.sort, order: q.order });
    return { ...list, unreadCount: await notificationRepository.unreadCount(userId) };
  },

  async markRead(userId: string, id: string) {
    const n = await notificationRepository.markRead(userId, id);
    if (!n) throw new NotFoundError('Notification not found');
    return n.toJSON();
  },

  async remove(userId: string, id: string) {
    const n = await notificationRepository.deleteOwned(userId, id);
    if (!n) throw new NotFoundError('Notification not found');
  },

  /** Server-side creation (admin tools, scheduled jobs, seed). Not exposed to regular users. */
  async create(input: CreateNotificationInput) {
    return (await notificationRepository.create(input)).toJSON();
  },
};
