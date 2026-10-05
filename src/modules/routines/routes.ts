import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { routineController } from './controller';
import { completeBody, createRoutineBody, listRoutinesQuery, reorderBody, updateRoutineBody } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/routines', tags: ['Routines'], summary: 'List daily routine items', auth: true, query: listRoutinesQuery, paginated: true }),
  routineController.list);

router.post('/reorder', authorize('WRITE'),
  ...doc({ method: 'post', path: '/routines/reorder', tags: ['Routines'], summary: 'Reorder routine items by ordered id list', auth: true, body: reorderBody }),
  routineController.reorder);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/routines/:id', tags: ['Routines'], summary: 'Get one routine item (own data only)', auth: true, params: idParams }),
  routineController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/routines', tags: ['Routines'], summary: 'Create a routine item', auth: true, body: createRoutineBody, successStatus: 201 }),
  routineController.create);

router.put('/:id/complete', authorize('WRITE'),
  ...doc({ method: 'put', path: '/routines/:id/complete', tags: ['Routines'], summary: 'Mark a routine item complete/incomplete', auth: true, params: idParams, body: completeBody }),
  routineController.complete);

router.put('/:id', authorize('WRITE'),
  ...doc({ method: 'put', path: '/routines/:id', tags: ['Routines'], summary: 'Update a routine item', auth: true, params: idParams, body: updateRoutineBody }),
  routineController.update);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/routines/:id', tags: ['Routines'], summary: 'Delete a routine item', auth: true, params: idParams, successStatus: 204 }),
  routineController.remove);

export default router;
