import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { calendarController } from './controller';
import { createEventBody, listEventsQuery, updateEventBody } from './schema';

const router = Router();
router.use(authenticate());

router.get('/events', authorize('READ'),
  ...doc({ method: 'get', path: '/calendar/events', tags: ['Calendar'], summary: 'List events (filter by Gregorian or Bikram Sambat dates)', auth: true, query: listEventsQuery, paginated: true }),
  calendarController.list);

router.get('/events/:id', authorize('READ'),
  ...doc({ method: 'get', path: '/calendar/events/:id', tags: ['Calendar'], summary: 'Get one event (own data only)', auth: true, params: idParams }),
  calendarController.get);

router.post('/events', authorize('WRITE'),
  ...doc({ method: 'post', path: '/calendar/events', tags: ['Calendar'], summary: 'Create an event', auth: true, body: createEventBody, successStatus: 201 }),
  calendarController.create);

router.put('/events/:id', authorize('WRITE'),
  ...doc({ method: 'put', path: '/calendar/events/:id', tags: ['Calendar'], summary: 'Update an event', auth: true, params: idParams, body: updateEventBody }),
  calendarController.update);

router.delete('/events/:id', authorize('DELETE'),
  ...doc({ method: 'delete', path: '/calendar/events/:id', tags: ['Calendar'], summary: 'Delete an event', auth: true, params: idParams, successStatus: 204 }),
  calendarController.remove);

export default router;
