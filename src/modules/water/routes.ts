import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { waterController } from './controller';
import { createWaterBody, listWaterQuery } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/water', tags: ['Water'], summary: 'List water entries with daily totals', auth: true, query: listWaterQuery, paginated: true }),
  waterController.list);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/water/:id', tags: ['Water'], summary: 'Get one water entry (own data only)', auth: true, params: idParams }),
  waterController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/water', tags: ['Water'], summary: 'Log water intake', auth: true, body: createWaterBody, successStatus: 201 }),
  waterController.create);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/water/:id', tags: ['Water'], summary: 'Delete a water entry', auth: true, params: idParams, successStatus: 204 }),
  waterController.remove);

export default router;
