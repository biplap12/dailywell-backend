import { NotificationModel } from './model';
import type { CreateNotificationInput } from './types';

export const notificationRepository = {
  create(input: CreateNotificationInput) {
    return NotificationModel.create(input);
  },

  unreadCount(userId: string) {
    return NotificationModel.countDocuments({ userId, isRead: false }).exec();
  },

  markRead(userId: string, id: string) {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    ).exec();
  },

  deleteOwned(userId: string, id: string) {
    return NotificationModel.findOneAndDelete({ _id: id, userId }).exec();
  },
};
