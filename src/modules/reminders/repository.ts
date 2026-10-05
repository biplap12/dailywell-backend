import { ReminderModel } from './model';

export const reminderRepository = {
  findEnabledForUser(userId: string) {
    return ReminderModel.find({ userId, isEnabled: true, deletedAt: null }).sort({ time: 1 }).lean();
  },
};
