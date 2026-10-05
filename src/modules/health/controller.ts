import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendError, sendSuccess } from '../../common/utils/response';
import { healthService } from './service';

export const healthController = {
  health: asyncHandler(async (_req, res) => {
    const { ready, ...data } = await healthService.status();
    if (!ready) return void sendError(res, 503, 'Service unavailable', 'SERVICE_UNAVAILABLE', data);
    sendSuccess(res, data, 'Service healthy');
  }),

  live: asyncHandler(async (_req, res) => {
    sendSuccess(res, { status: 'alive', uptime: Math.round(process.uptime()) }, 'Alive');
  }),

  ready: asyncHandler(async (_req, res) => {
    const { ready, ...data } = await healthService.status();
    if (!ready) return void sendError(res, 503, 'Not ready', 'SERVICE_UNAVAILABLE', data);
    sendSuccess(res, { status: 'ready', ...data }, 'Ready');
  }),
};
