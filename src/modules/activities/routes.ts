import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { activityController } from './controller';
import { createActivityBody, listActivitiesQuery } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/activities', tags: ['Activities'], summary: 'List activity logs', auth: true, query: listActivitiesQuery, paginated: true }),
  activityController.list);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/activities/:id', tags: ['Activities'], summary: 'Get one activity (own data only)', auth: true, params: idParams }),
  activityController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/activities', tags: ['Activities'], summary: 'Log an activity', auth: true, body: createActivityBody, successStatus: 201 }),
  activityController.create);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/activities/:id', tags: ['Activities'], summary: 'Delete an activity', auth: true, params: idParams, successStatus: 204 }),
  activityController.remove);

export default router;
