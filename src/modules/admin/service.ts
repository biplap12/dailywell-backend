import { AuthorizationError, NotFoundError } from '../../common/errors';
import { ROLE_RANK, type Role } from '../../common/constants';
import { buildPagination, skipFor } from '../../common/utils/pagination';
import { auditService } from '../audit/service';
import { sessionRepository } from '../auth/repository';
import { userRepository } from '../users/repository';
import { toPublicUser } from '../users/service';

export const adminService = {
  async listUsers(q: { page: number; limit: number; sort: string; order: 'asc' | 'desc'; role?: Role; isSuspended?: boolean }) {
    const { items, total } = await userRepository.list(
      { role: q.role, isSuspended: q.isSuspended },
      skipFor(q.page, q.limit),
      q.limit,
      { [q.sort]: q.order === 'asc' ? 1 : -1 },
    );
    return { items: items.map(toPublicUser), pagination: buildPagination(q.page, q.limit, total) };
  },

  async setSuspended(actor: { userId: string; role: Role }, targetId: string, isSuspended: boolean, ip?: string | null) {
    const target = await userRepository.findById(targetId);
    if (!target) throw new NotFoundError('User not found');
    if (String(target._id) === actor.userId) throw new AuthorizationError('You cannot change your own suspension status');
    // You can only act on accounts strictly below your own rank.
    if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role]) throw new AuthorizationError('You cannot manage an account of equal or higher rank');

    const updated = await userRepository.updateById(targetId, { isSuspended });
    if (isSuspended) await sessionRepository.revokeAllForUser(targetId); // kicks them off every device
    await auditService.record({ actorId: actor.userId, action: isSuspended ? 'USER_SUSPENDED' : 'USER_REINSTATED', entityType: 'user', entityId: targetId, ip });
    return toPublicUser(updated!);
  },

  async setRole(actor: { userId: string }, targetId: string, role: 'ADMIN' | 'USER', ip?: string | null) {
    const target = await userRepository.findById(targetId);
    if (!target) throw new NotFoundError('User not found');
    if (String(target._id) === actor.userId) throw new AuthorizationError('You cannot change your own role');
    if (target.role === 'SUPER_ADMIN' || target.role === 'GUEST') throw new AuthorizationError('This account\'s role cannot be changed');
    const updated = await userRepository.updateById(targetId, { role });
    await auditService.record({ actorId: actor.userId, action: 'USER_ROLE_CHANGED', entityType: 'user', entityId: targetId, ip, metadata: { from: target.role, to: role } });
    return toPublicUser(updated!);
  },

  async listAudit(q: { page: number; limit: number; action?: string; actorId?: string }) {
    const { items, total } = await auditService.list(skipFor(q.page, q.limit), q.limit, { action: q.action, actorId: q.actorId });
    return { items, pagination: buildPagination(q.page, q.limit, total) };
  },
};
