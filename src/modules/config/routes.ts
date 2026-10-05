import { Router } from 'express';
import { authenticate, requirePermission } from '../../common/middleware/auth';
import { idParams } from '../../common/validators';
import { doc } from '../../docs/registry';
import { configController } from './controller';
import { holidayBody, holidayQuery, holidayUpdateBody, updateConfigBody } from './schema';

const router = Router();

// ---- Public (mobile clients call these before login) ----
router.get(
  '/',
  ...doc({ method: 'get', path: '/config', tags: ['Config'], summary: 'Get remote app configuration' }),
  configController.get,
);

router.get(
  '/holidays',
  ...doc({ method: 'get', path: '/config/holidays', tags: ['Config', 'Holidays'], summary: 'List holidays (Gregorian + Bikram Sambat)', query: holidayQuery, paginated: true }),
  configController.holidays,
);

// ---- Administration (RBAC enforced server-side) ----
router.put(
  '/',
  authenticate(),
  requirePermission('MANAGE_CONFIG'),
  ...doc({ method: 'put', path: '/config', tags: ['Config', 'Admin'], summary: 'Update remote configuration (SUPER_ADMIN)', auth: true, body: updateConfigBody }),
  configController.update,
);

router.post(
  '/holidays',
  authenticate(),
  requirePermission('MANAGE_HOLIDAYS'),
  ...doc({ method: 'post', path: '/config/holidays', tags: ['Holidays', 'Admin'], summary: 'Create a holiday', auth: true, body: holidayBody, successStatus: 201 }),
  configController.createHoliday,
);

router.put(
  '/holidays/:id',
  authenticate(),
  requirePermission('MANAGE_HOLIDAYS'),
  ...doc({ method: 'put', path: '/config/holidays/:id', tags: ['Holidays', 'Admin'], summary: 'Update a holiday', auth: true, params: idParams, body: holidayUpdateBody }),
  configController.updateHoliday,
);

router.delete(
  '/holidays/:id',
  authenticate(),
  requirePermission('MANAGE_HOLIDAYS'),
  ...doc({ method: 'delete', path: '/config/holidays/:id', tags: ['Holidays', 'Admin'], summary: 'Delete a holiday', auth: true, params: idParams, successStatus: 204 }),
  configController.deleteHoliday,
);

export default router;
