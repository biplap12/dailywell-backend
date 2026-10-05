export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER', 'GUEST'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'READ',
  'WRITE',
  'DELETE',
  'SYNC',
  'MANAGE_USERS',
  'MANAGE_CONFIG',
  'MANAGE_HOLIDAYS',
  'VIEW_AUDIT',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission matrix. The server is the only source of truth for RBAC;
 * clients must never be trusted to enforce it.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: ['READ', 'WRITE', 'DELETE', 'SYNC', 'MANAGE_USERS', 'MANAGE_HOLIDAYS', 'VIEW_AUDIT'],
  USER: ['READ', 'WRITE', 'DELETE', 'SYNC'],
  // Guests: own-data access only, no bulk sync, no admin capability.
  GUEST: ['READ', 'WRITE', 'DELETE'],
};

export const ROLE_RANK: Record<Role, number> = { GUEST: 0, USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export const ROUTINE_CATEGORIES = ['MORNING', 'HEALTH', 'WORK', 'STUDY', 'EXERCISE', 'EVENING', 'SLEEP', 'CUSTOM'] as const;
export const REPEAT_TYPES = ['ONCE', 'DAILY', 'WEEKLY', 'CUSTOM'] as const;
export const SYNC_STATUSES = ['SYNCED', 'PENDING', 'CONFLICT'] as const;
export const SYNC_ENTITY_TYPES = [
  'water',
  'sleep',
  'habit',
  'habit_completion',
  'routine',
  'reminder',
  'steps',
  'activity',
  'calendar_event',
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
export const SYNC_OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export type SyncOperationType = (typeof SYNC_OPERATIONS)[number];

export const NOTIFICATION_CATEGORIES = ['SYSTEM', 'REMINDER', 'HEALTH', 'ACHIEVEMENT', 'HOLIDAY', 'PROMOTION'] as const;
export const NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const;

export const HOLIDAY_TYPES = ['PUBLIC', 'RELIGIOUS', 'CULTURAL', 'OBSERVANCE'] as const;

export const API_PREFIX = '/api/v1';
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;
