import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { reminderController } from './controller';
import { createReminderBody, listRemindersQuery, updateReminderBody } from './schema';

const router = Router();
router.use(authenticate());

router.get('/', authorize('READ'),
  ...doc({ method: 'get', path: '/reminders', tags: ['Reminders'], summary: 'List reminders', auth: true, query: listRemindersQuery, paginated: true }),
  reminderController.list);

router.get('/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/reminders/:id', tags: ['Reminders'], summary: 'Get one reminder (own data only)', auth: true, params: idParams }),
  reminderController.get);

router.post('/', authorize('WRITE'),
  ...doc({ method: 'post', path: '/reminders', tags: ['Reminders'], summary: 'Create a reminder', auth: true, body: createReminderBody, successStatus: 201 }),
  reminderController.create);

router.put('/:id', authorize('WRITE'),
  ...doc({ method: 'put', path: '/reminders/:id', tags: ['Reminders'], summary: 'Update a reminder', auth: true, params: idParams, body: updateReminderBody }),
  reminderController.update);

router.delete('/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/reminders/:id', tags: ['Reminders'], summary: 'Delete a reminder', auth: true, params: idParams, successStatus: 204 }),
  reminderController.remove);

export default router;
