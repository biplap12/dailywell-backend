import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../../common/utils/response';
import { notificationService } from './service';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await notificationService.list(req.auth!.userId, req.query as any), 'Notifications fetched');
  }),
  markRead: asyncHandler(async (req, res) => {
    sendSuccess(res, await notificationService.markRead(req.auth!.userId, req.params.id), 'Notification marked as read');
  }),
  remove: asyncHandler(async (req, res) => {
    await notificationService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
