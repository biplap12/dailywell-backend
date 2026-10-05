import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { habitService } from './service';

export const habitController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await habitService.list(req.auth!.userId, req.query as any), 'Habits fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await habitService.get(req.auth!.userId, req.params.id), 'Habit fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await habitService.create(req.auth!.userId, req.body), 'Habit created');
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await habitService.update(req.auth!.userId, req.params.id, req.body), 'Habit updated');
  }),
  remove: asyncHandler(async (req, res) => {
    await habitService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
  toggle: asyncHandler(async (req, res) => {
    sendSuccess(res, await habitService.toggle(req.auth!.userId, req.params.id, req.body), 'Habit toggled');
  }),
};
