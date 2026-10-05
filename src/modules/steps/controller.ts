import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../common/utils/response';
import { stepService } from './service';

export const stepController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await stepService.list(req.auth!.userId, req.query as any), 'Step records fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await stepService.get(req.auth!.userId, req.params.id), 'Step record fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await stepService.create(req.auth!.userId, req.body), 'Step record saved');
  }),
  batch: asyncHandler(async (req, res) => {
    sendSuccess(res, await stepService.batch(req.auth!.userId, req.body), 'Batch processed');
  }),
};
