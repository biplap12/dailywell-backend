import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { syncLimiter } from '../../common/middleware/rateLimit';
import { doc } from '../../docs/registry';
import { syncController } from './controller';
import { changesQuery, migrateGuestBody, uploadBody } from './schema';

const router = Router();
router.use(authenticate());

router.post(
  '/upload',
  authorize('SYNC'),
  syncLimiter,
  ...doc({
    method: 'post',
    path: '/sync/upload',
    tags: ['Sync'],
    summary: 'Upload queued offline operations (batch, idempotent)',
    description:
      'Operations run in order. Each has an `idempotencyKey`: resending a processed key returns the original result (status DUPLICATE) and changes nothing. ' +
      'Conflicts are detected via `baseVersion` / `clientUpdatedAt` / `deviceId` and resolved with the chosen strategy (default LAST_WRITE_WINS); every conflict is reported in `conflictDetails`.',
    auth: true,
    body: uploadBody,
    rateLimited: true,
  }),
  syncController.upload,
);

router.get(
  '/changes',
  authorize('SYNC'),
  ...doc({ method: 'get', path: '/sync/changes', tags: ['Sync'], summary: 'Download changes (including deletions) since a timestamp', auth: true, query: changesQuery }),
  syncController.changes,
);

router.post(
  '/migrate-guest',
  authorize('SYNC'),
  syncLimiter,
  ...doc({
    method: 'post',
    path: '/sync/migrate-guest',
    tags: ['Sync', 'Guest'],
    summary: 'Move a guest account\'s server data into the authenticated account',
    description: 'Destination is always the caller. The guest is proven by presenting its own refresh token.',
    auth: true,
    body: migrateGuestBody,
    rateLimited: true,
  }),
  syncController.migrateGuest,
);

export default router;
