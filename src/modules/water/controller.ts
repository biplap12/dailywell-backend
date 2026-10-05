import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { waterService } from './service';

export const waterController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await waterService.list(req.auth!.userId, req.query as any), 'Water entries fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await waterService.get(req.auth!.userId, req.params.id), 'Water entry fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await waterService.create(req.auth!.userId, req.body), 'Water entry created');
  }),
  remove: asyncHandler(async (req, res) => {
    await waterService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
