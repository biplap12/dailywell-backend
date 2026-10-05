import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { activityService } from './service';

export const activityController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await activityService.list(req.auth!.userId, req.query as any), 'Activities fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await activityService.get(req.auth!.userId, req.params.id), 'Activity fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await activityService.create(req.auth!.userId, req.body), 'Activity created');
  }),
  remove: asyncHandler(async (req, res) => {
    await activityService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
