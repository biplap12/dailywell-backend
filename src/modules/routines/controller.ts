import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { routineService } from './service';

export const routineController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await routineService.list(req.auth!.userId, req.query as any), 'Routines fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await routineService.get(req.auth!.userId, req.params.id), 'Routine fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await routineService.create(req.auth!.userId, req.body), 'Routine created');
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await routineService.update(req.auth!.userId, req.params.id, req.body), 'Routine updated');
  }),
  complete: asyncHandler(async (req, res) => {
    sendSuccess(res, await routineService.complete(req.auth!.userId, req.params.id, req.body), 'Routine completion updated');
  }),
  reorder: asyncHandler(async (req, res) => {
    sendSuccess(res, await routineService.reorder(req.auth!.userId, req.body.ids), 'Routines reordered');
  }),
  remove: asyncHandler(async (req, res) => {
    await routineService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
