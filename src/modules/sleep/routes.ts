import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { sleepController } from './controller';
import { createSleepBody, listSleepQuery, updateSleepBody } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/sleep', tags: ['Sleep'], summary: 'List sleep entries', auth: true, query: listSleepQuery, paginated: true }),
  sleepController.list);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/sleep/:id', tags: ['Sleep'], summary: 'Get one sleep entry (own data only)', auth: true, params: idParams }),
  sleepController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/sleep', tags: ['Sleep'], summary: 'Log a sleep session', auth: true, body: createSleepBody, successStatus: 201 }),
  sleepController.create);

router.put('/:id', authorize('WRITE'),
  ...doc({ method: 'put', path: '/sleep/:id', tags: ['Sleep'], summary: 'Update a sleep entry (optional `version` for optimistic locking)', auth: true, params: idParams, body: updateSleepBody }),
  sleepController.update);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/sleep/:id', tags: ['Sleep'], summary: 'Delete a sleep entry', auth: true, params: idParams, successStatus: 204 }),
  sleepController.remove);

export default router;
