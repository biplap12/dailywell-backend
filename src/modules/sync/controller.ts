import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess } from '../../common/utils/response';
import { migrateGuest } from './guestMigration';
import { syncService } from './service';

export const syncController = {
  upload: asyncHandler(async (req, res) => {
    const summary = await syncService.upload(req.auth!.userId, req.body);
    sendSuccess(
      res,
      {
        processed: summary.processed,
        failed: summary.failed,
        conflicts: summary.conflicts,
        duplicates: summary.duplicates,
        idMappings: summary.idMappings,
        changes: summary.changes,
        conflictDetails: summary.conflictDetails,
        results: summary.results,
      },
      'Synchronization completed',
    );
  }),

  changes: asyncHandler(async (req, res) => {
    const { since, limit } = req.query as unknown as { since: string; limit: number };
    sendSuccess(res, await syncService.changes(req.auth!.userId, new Date(since), limit), 'Changes fetched');
  }),

  migrateGuest: asyncHandler(async (req, res) => {
    sendSuccess(res, await migrateGuest(req.auth!.userId, req.body.guestRefreshToken, req.ip), 'Guest data migrated');
  }),
};
