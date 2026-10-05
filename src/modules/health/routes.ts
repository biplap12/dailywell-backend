import { Router } from 'express';
import { healthController } from './controller';

/** Mounted at the root (outside /api/v1) so load balancers and orchestrators can probe it directly. */
const router = Router();

router.get('/', healthController.health);
router.get('/live', healthController.live);
router.get('/ready', healthController.ready);

export default router;
