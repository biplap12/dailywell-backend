import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { habitController } from './controller';
import { createHabitBody, listHabitsQuery, toggleHabitBody, updateHabitBody } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/habits', tags: ['Habits'], summary: 'List habits (with completion state for a date)', auth: true, query: listHabitsQuery, paginated: true }),
  habitController.list);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/habits/:id', tags: ['Habits'], summary: 'Get one habit (own data only)', auth: true, params: idParams }),
  habitController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/habits', tags: ['Habits'], summary: 'Create a habit', auth: true, body: createHabitBody, successStatus: 201 }),
  habitController.create);

router.put('/:id', authorize('WRITE'),
  ...doc({ method: 'put', path: '/habits/:id', tags: ['Habits'], summary: 'Update a habit', auth: true, params: idParams, body: updateHabitBody }),
  habitController.update);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/habits/:id', tags: ['Habits'], summary: 'Delete a habit and its completions', auth: true, params: idParams, successStatus: 204 }),
  habitController.remove);

router.post('/:id/toggle', authorize('WRITE'),
  ...doc({ method: 'post', path: '/habits/:id/toggle', tags: ['Habits'], summary: 'Toggle completion for a date (default today); recalculates streak', auth: true, params: idParams, body: toggleHabitBody }),
  habitController.toggle);

export default router;
