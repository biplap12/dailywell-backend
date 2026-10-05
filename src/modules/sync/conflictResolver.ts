import type { ConflictResolution, ConflictStrategyName } from './types';

export interface ConflictContext {
  clientUpdatedAt: Date;
  serverUpdatedAt: Date;
  clientDeviceId: string | null;
  serverDeviceId: string | null;
}

export interface ConflictResolver {
  readonly name: ConflictStrategyName;
  resolve(ctx: ConflictContext): ConflictResolution;
}

/** Newest modification wins. Ties go to the server so a retry can never clobber data. */
const lastWriteWins: ConflictResolver = {
  name: 'LAST_WRITE_WINS',
  resolve: ({ clientUpdatedAt, serverUpdatedAt }) =>
    clientUpdatedAt.getTime() > serverUpdatedAt.getTime() ? 'CLIENT_WINS' : 'SERVER_WINS',
};

const serverWins: ConflictResolver = { name: 'SERVER_WINS', resolve: () => 'SERVER_WINS' };
const clientWins: ConflictResolver = { name: 'CLIENT_WINS', resolve: () => 'CLIENT_WINS' };

const resolvers: Record<ConflictStrategyName, ConflictResolver> = {
  LAST_WRITE_WINS: lastWriteWins,
  SERVER_WINS: serverWins,
  CLIENT_WINS: clientWins,
};

export const DEFAULT_CONFLICT_STRATEGY: ConflictStrategyName = 'LAST_WRITE_WINS';

/** Strategies are looked up by name so new ones (field-level merge, etc.) can be registered without touching the sync engine. */
export function registerConflictResolver(resolver: ConflictResolver): void {
  resolvers[resolver.name] = resolver;
}

export function getConflictResolver(name: ConflictStrategyName = DEFAULT_CONFLICT_STRATEGY): ConflictResolver {
  return resolvers[name] ?? lastWriteWins;
}
