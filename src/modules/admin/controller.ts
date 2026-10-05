import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../common/utils/response';
import { notificationService } from '../notifications/service';
import { adminService } from './service';

export const adminController = {
  listUsers: asyncHandler(async (req, res) => {
    sendSuccess(res, await adminService.listUsers(req.query as any), 'Users fetched');
  }),
  setSuspended: asyncHandler(async (req, res) => {
    sendSuccess(res, await adminService.setSuspended(req.auth!, req.params.id, req.body.isSuspended, req.ip), 'User status updated');
  }),
  setRole: asyncHandler(async (req, res) => {
    sendSuccess(res, await adminService.setRole(req.auth!, req.params.id, req.body.role, req.ip), 'User role updated');
  }),
  audit: asyncHandler(async (req, res) => {
    sendSuccess(res, await adminService.listAudit(req.query as any), 'Audit log fetched');
  }),
  sendNotification: asyncHandler(async (req, res) => {
    sendCreated(res, await notificationService.create(req.body), 'Notification sent');
  }),
};
