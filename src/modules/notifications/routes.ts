import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { notificationController } from './controller';
import { listNotificationsQuery } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/notifications', tags: ['Notifications'], summary: 'List notifications (English + Nepali) with unread count', auth: true, query: listNotificationsQuery, paginated: true }),
  notificationController.list);

router.put('/:id/read', authorize('WRITE'),
  ...doc({ method: 'put', path: '/notifications/:id/read', tags: ['Notifications'], summary: 'Mark a notification as read', auth: true, params: idParams }),
  notificationController.markRead);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/notifications/:id', tags: ['Notifications'], summary: 'Delete a notification', auth: true, params: idParams, successStatus: 204 }),
  notificationController.remove);

export default router;
