import { NotFoundError } from '../../common/errors';
import { buildPagination, skipFor } from '../../common/utils/pagination';
import { auditService } from '../audit/service';
import { configRepository } from './repository';
import type { PublicRemoteConfig } from './types';

const CACHE_TTL_MS = 15_000;
let cache: { value: PublicRemoteConfig; at: number } | null = null;

function pick(doc: Record<string, any>): PublicRemoteConfig {
  return {
    maintenanceMode: doc.maintenanceMode,
    registrationEnabled: doc.registrationEnabled,
    guestAccessEnabled: doc.guestAccessEnabled,
    notificationsEnabled: doc.notificationsEnabled,
    offlineModeEnabled: doc.offlineModeEnabled,
    minimumAppVersion: doc.minimumAppVersion,
    latestAppVersion: doc.latestAppVersion,
  };
}

export const configService = {
  async get(): Promise<PublicRemoteConfig> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
    const doc = await configRepository.getOrCreate();
    const value = pick(doc as Record<string, any>);
    cache = { value, at: Date.now() };
    return value;
  },

  clearCache(): void {
    cache = null;
  },

  async update(patch: Partial<PublicRemoteConfig>, actorId: string): Promise<PublicRemoteConfig> {
    const doc = await configRepository.update(patch);
    cache = null;
    await auditService.record({ actorId, action: 'CONFIG_UPDATE', entityType: 'remote_config', entityId: 'app', metadata: patch });
    return pick(doc as Record<string, any>);
  },

  async listHolidays(query: { page: number; limit: number; order: 'asc' | 'desc'; year?: string; type?: string; from?: string; to?: string; isNational?: boolean }) {
    const { items, total } = await configRepository.listHolidays(query, skipFor(query.page, query.limit), query.limit, query.order === 'asc' ? 1 : -1);
    return { items: items.map((h) => h.toJSON()), pagination: buildPagination(query.page, query.limit, total) };
  },

  async createHoliday(data: Record<string, unknown>, actorId: string) {
    const h = await configRepository.createHoliday(data);
    await auditService.record({ actorId, action: 'HOLIDAY_CREATE', entityType: 'holiday', entityId: String(h._id) });
    return h.toJSON();
  },

  async updateHoliday(id: string, patch: Record<string, unknown>, actorId: string) {
    const h = await configRepository.updateHoliday(id, patch);
    if (!h) throw new NotFoundError('Holiday not found');
    await auditService.record({ actorId, action: 'HOLIDAY_UPDATE', entityType: 'holiday', entityId: id });
    return h.toJSON();
  },

  async deleteHoliday(id: string, actorId: string) {
    const h = await configRepository.deleteHoliday(id);
    if (!h) throw new NotFoundError('Holiday not found');
    await auditService.record({ actorId, action: 'HOLIDAY_DELETE', entityType: 'holiday', entityId: id });
  },
};
