import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { doc } from '../../docs/registry';
import { userController } from './controller';
import { goalsBody, stepGoalBody } from './schema';

const router = Router();
router.use(authenticate());

router.get(
  '/me',
  authorize('READ'),
  ...doc({ method: 'get', path: '/users/me', tags: ['Users'], summary: 'Get my profile', auth: true }),
  userController.me,
);

router.put(
  '/step-goal',
  authorize('WRITE'),
  ...doc({ method: 'put', path: '/users/step-goal', tags: ['Users', 'Steps'], summary: 'Update daily step goal', auth: true, body: stepGoalBody }),
  userController.updateStepGoal,
);

router.put(
  '/settings',
  authorize('WRITE'),
  ...doc({ method: 'put', path: '/users/settings', tags: ['Users'], summary: 'Update goals and profile settings', auth: true, body: goalsBody }),
  userController.updateSettings,
);

export default router;
