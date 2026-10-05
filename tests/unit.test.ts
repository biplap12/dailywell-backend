import { describe, expect, it } from 'vitest';
import { getConflictResolver, registerConflictResolver } from '../src/modules/sync/conflictResolver';
import { computeStreak } from '../src/modules/habits/service';
import { ROLE_PERMISSIONS } from '../src/common/constants';
import { createWaterBody } from '../src/modules/water/schema';
import { dateString, timeString } from '../src/common/validators';

describe('conflict resolver', () => {
  const server = new Date('2026-01-02T00:00:00Z');
  const ctx = (client: string) => ({ clientUpdatedAt: new Date(client), serverUpdatedAt: server, clientDeviceId: 'a', serverDeviceId: 'b' });

  it('LAST_WRITE_WINS picks the newer side and ties go to the server', () => {
    const r = getConflictResolver('LAST_WRITE_WINS');
    expect(r.resolve(ctx('2026-01-03T00:00:00Z'))).toBe('CLIENT_WINS');
    expect(r.resolve(ctx('2026-01-01T00:00:00Z'))).toBe('SERVER_WINS');
    expect(r.resolve(ctx('2026-01-02T00:00:00Z'))).toBe('SERVER_WINS');
  });

  it('new strategies can be registered without touching the engine', () => {
    registerConflictResolver({ name: 'SERVER_WINS', resolve: () => 'CLIENT_WINS' });
    expect(getConflictResolver('SERVER_WINS').resolve(ctx('2000-01-01T00:00:00Z'))).toBe('CLIENT_WINS');
    registerConflictResolver({ name: 'SERVER_WINS', resolve: () => 'SERVER_WINS' });
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(computeStreak(['2026-10-05', '2026-10-04', '2026-10-03'], '2026-10-05')).toBe(3);
    expect(computeStreak(['2026-10-04', '2026-10-03'], '2026-10-05')).toBe(2); // today not done yet
    expect(computeStreak(['2026-10-03'], '2026-10-05')).toBe(0); // broken
    expect(computeStreak(['2026-10-05', '2026-10-03'], '2026-10-05')).toBe(1); // gap
    expect(computeStreak([], '2026-10-05')).toBe(0);
  });
});

describe('RBAC matrix', () => {
  it('guests cannot sync or administer; admins cannot manage config', () => {
    expect(ROLE_PERMISSIONS.GUEST).not.toContain('SYNC');
    expect(ROLE_PERMISSIONS.GUEST).not.toContain('MANAGE_USERS');
    expect(ROLE_PERMISSIONS.USER).toContain('SYNC');
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('MANAGE_CONFIG');
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('MANAGE_CONFIG');
  });
});

describe('validators', () => {
  it('validates real calendar dates and 24h times', () => {
    expect(dateString.safeParse('2026-02-28').success).toBe(true);
    expect(dateString.safeParse('2026-02-30').success).toBe(false);
    expect(dateString.safeParse('26-1-1').success).toBe(false);
    expect(timeString.safeParse('23:59').success).toBe(true);
    expect(timeString.safeParse('24:00').success).toBe(false);
    expect(createWaterBody.safeParse({ amountMl: 250, date: '2026-10-04', time: '08:30' }).success).toBe(true);
  });
});
