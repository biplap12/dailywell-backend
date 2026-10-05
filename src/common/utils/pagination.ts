import type { Paginated } from '../types';

export function buildPagination(page: number, limit: number, total: number): Paginated<never>['pagination'] {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function skipFor(page: number, limit: number): number {
  return (page - 1) * limit;
}
