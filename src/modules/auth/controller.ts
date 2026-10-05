import type { Request } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../common/utils/response';
import { userService } from '../users/service';
import { authService } from './service';
import type { ClientContext } from './types';

function ctxOf(req: Request): ClientContext {
  return {
    deviceId: (req.body?.deviceId as string | undefined) ?? null,
    userAgent: req.header('user-agent') ?? null,
    ip: req.ip ?? null,
  };
}

export const authController = {
  register: asyncHandler(async (req, res) => {
    sendCreated(res, await authService.register(req.body, ctxOf(req)), 'Registration successful');
  }),

  login: asyncHandler(async (req, res) => {
    sendSuccess(res, await authService.login(req.body, ctxOf(req)), 'Login successful');
  }),

  refresh: asyncHandler(async (req, res) => {
    sendSuccess(res, await authService.refresh(req.body.refreshToken, ctxOf(req)), 'Token refreshed');
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    sendSuccess(res, {}, 'Logged out');
  }),

  guest: asyncHandler(async (req, res) => {
    sendCreated(res, await authService.createGuest(ctxOf(req)), 'Guest session created');
  }),

  profile: asyncHandler(async (req, res) => {
    sendSuccess(res, await userService.getProfile(req.auth!.userId), 'Profile fetched');
  }),
};
