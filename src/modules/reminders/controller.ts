import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { reminderService } from './service';

export const reminderController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await reminderService.list(req.auth!.userId, req.query as any), 'Reminders fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await reminderService.get(req.auth!.userId, req.params.id), 'Reminder fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await reminderService.create(req.auth!.userId, req.body), 'Reminder created');
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await reminderService.update(req.auth!.userId, req.params.id, req.body), 'Reminder updated');
  }),
  remove: asyncHandler(async (req, res) => {
    await reminderService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
