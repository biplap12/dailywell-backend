import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { configService } from './service';

export const configController = {
  get: asyncHandler(async (_req, res) => {
    sendSuccess(res, await configService.get(), 'Configuration fetched');
  }),

  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await configService.update(req.body, req.auth!.userId), 'Configuration updated');
  }),

  holidays: asyncHandler(async (req, res) => {
    sendSuccess(res, await configService.listHolidays(req.query as any), 'Holidays fetched');
  }),

  createHoliday: asyncHandler(async (req, res) => {
    sendCreated(res, await configService.createHoliday(req.body, req.auth!.userId), 'Holiday created');
  }),

  updateHoliday: asyncHandler(async (req, res) => {
    sendSuccess(res, await configService.updateHoliday(req.params.id, req.body, req.auth!.userId), 'Holiday updated');
  }),

  deleteHoliday: asyncHandler(async (req, res) => {
    await configService.deleteHoliday(req.params.id, req.auth!.userId);
    sendNoContent(res);
  }),
};
