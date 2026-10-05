import { Router } from 'express';
import { authenticate, requirePermission, requireRole } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { createNotificationBody } from '../notifications/schema';
import { adminController } from './controller';
import { auditQuery, listUsersQuery, roleBody, suspendBody } from './schema';

/**
 * Backend foundation for a future admin dashboard. Every route is RBAC-protected on the server.
 */
const router = Router();
router.use(authenticate());

router.get('/users', requirePermission('MANAGE_USERS'),
  ...doc({ method: 'get', path: '/admin/users', tags: ['Admin'], summary: 'List users', auth: true, query: listUsersQuery, paginated: true }),
  adminController.listUsers);

router.put('/users/:id/suspension', requirePermission('MANAGE_USERS'),
  ...doc({ method: 'put', path: '/admin/users/:id/suspension', tags: ['Admin'], summary: 'Suspend or reinstate a user (revokes their sessions)', auth: true, params: idParams, body: suspendBody }),
  adminController.setSuspended);

router.put('/users/:id/role', requireRole('SUPER_ADMIN'),
  ...doc({ method: 'put', path: '/admin/users/:id/role', tags: ['Admin'], summary: 'Change a user\'s role (SUPER_ADMIN only)', auth: true, params: idParams, body: roleBody }),
  adminController.setRole);

router.get('/audit-logs', requirePermission('VIEW_AUDIT'),
  ...doc({ method: 'get', path: '/admin/audit-logs', tags: ['Admin'], summary: 'List audit logs', auth: true, query: auditQuery, paginated: true }),
  adminController.audit);

router.post('/notifications', requirePermission('MANAGE_USERS'),
  ...doc({ method: 'post', path: '/admin/notifications', tags: ['Admin', 'Notifications'], summary: 'Send a bilingual notification to a user', auth: true, body: createNotificationBody, successStatus: 201 }),
  adminController.sendNotification);

export default router;
