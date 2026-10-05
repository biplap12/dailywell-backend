import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { sleepService } from './service';

export const sleepController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await sleepService.list(req.auth!.userId, req.query as any), 'Sleep entries fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await sleepService.get(req.auth!.userId, req.params.id), 'Sleep entry fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await sleepService.create(req.auth!.userId, req.body), 'Sleep entry created');
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await sleepService.update(req.auth!.userId, req.params.id, req.body), 'Sleep entry updated');
  }),
  remove: asyncHandler(async (req, res) => {
    await sleepService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
