import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { userService } from './service';

export const userController = {
  me: asyncHandler(async (req, res) => {
    sendSuccess(res, await userService.getProfile(req.auth!.userId), 'Profile fetched');
  }),

  updateStepGoal: asyncHandler(async (req, res) => {
    const user = await userService.updateStepGoal(req.auth!.userId, req.body.stepGoal);
    sendSuccess(res, user, 'Step goal updated');
  }),

  updateSettings: asyncHandler(async (req, res) => {
    sendSuccess(res, await userService.updateSettings(req.auth!.userId, req.body), 'Settings updated');
  }),
};
