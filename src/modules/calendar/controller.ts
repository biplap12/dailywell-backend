import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/response';
import { calendarService } from './service';

export const calendarController = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await calendarService.list(req.auth!.userId, req.query), 'Events fetched');
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await calendarService.get(req.auth!.userId, req.params.id), 'Event fetched');
  }),
  create: asyncHandler(async (req, res) => {
    sendCreated(res, await calendarService.create(req.auth!.userId, req.body), 'Event created');
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, await calendarService.update(req.auth!.userId, req.params.id, req.body), 'Event updated');
  }),
  remove: asyncHandler(async (req, res) => {
    await calendarService.remove(req.auth!.userId, req.params.id);
    sendNoContent(res);
  }),
};
