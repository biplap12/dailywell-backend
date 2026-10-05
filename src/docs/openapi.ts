import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { env } from '../config/env';
import { getRegisteredRoutes, type RouteDoc } from './registry';

type Json = Record<string, any>;

function toSchema(schema: ZodTypeAny): Json {
  // zod-to-json-schema's generic signature blows up TS inference on arbitrary schemas; the cast is intentional.
  const convert = zodToJsonSchema as unknown as (s: ZodTypeAny, o: Json) => Json;
  const js = convert(schema, { target: 'openApi3', $refStrategy: 'none' });
  delete js.$schema;
  return js;
}

function toParameters(schema: ZodTypeAny, where: 'query' | 'path' | 'header'): Json[] {
  const js = toSchema(schema);
  const required: string[] = js.required ?? [];
  return Object.entries<Json>(js.properties ?? {}).map(([name, s]) => ({
    name,
    in: where,
    required: where === 'path' ? true : required.includes(name),
    schema: s,
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
});

function operationFor(r: RouteDoc): Json {
  const parameters: Json[] = [];
  if (r.params) parameters.push(...toParameters(r.params, 'path'));
  if (r.query) parameters.push(...toParameters(r.query, 'query'));

  const status = String(r.successStatus ?? 200);
  const responses: Json = {};

  if (status === '204') {
    responses['204'] = { description: 'No content' };
  } else {
    responses[status] = {
      description: 'Success',
      content: {
        'application/json': {
          schema: { $ref: r.paginated ? '#/components/schemas/PaginatedEnvelope' : '#/components/schemas/SuccessEnvelope' },
        },
      },
    };
  }
  if (r.body || r.query || r.params) responses['422'] = errorResponse('Validation failed');
  responses['400'] = errorResponse('Malformed request');
  if (r.auth) {
    responses['401'] = errorResponse('Missing, invalid or expired access token');
    responses['403'] = errorResponse('Role lacks the required permission');
    responses['404'] = errorResponse('Resource not found (or owned by another user)');
  }
  if (r.rateLimited) responses['429'] = errorResponse('Rate limit exceeded');
  responses['500'] = errorResponse('Unexpected server error');

  const op: Json = {
    tags: r.tags,
    summary: r.summary,
    ...(r.description ? { description: r.description } : {}),
    ...(r.auth ? { security: [{ bearerAuth: [] }] } : {}),
    ...(parameters.length ? { parameters } : {}),
    responses,
  };
  if (r.body) {
    op.requestBody = { required: true, content: { 'application/json': { schema: toSchema(r.body) } } };
  }
  return op;
}

/**
 * Builds the OpenAPI document from the routes that were actually registered at startup.
 * Request schemas are the very same Zod objects that validate traffic, so they cannot drift.
 */
export function buildOpenApiDocument(): Json {
  const paths: Json = {};
  for (const route of getRegisteredRoutes()) {
    const p = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    paths[p] ??= {};
    paths[p][route.method] = operationFor(route);
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'DailyWell API',
      version: '1.0.0',
      description:
        'REST API for the DailyWell wellness app (water, sleep, habits, routines, reminders, steps, activities, calendar, notifications) with offline-first synchronization.\n\n' +
        '**Auth:** send `Authorization: Bearer <accessToken>`. Access tokens are short-lived; rotate with `/auth/refresh` (refresh tokens are single-use).\n\n' +
        '**Envelope:** every response is `{ success, message, data }` or `{ success: false, message, error: { code, details } }`.\n\n' +
        '**Pagination:** list endpoints accept `page`, `limit` (max 100), `sort`, `order` and return `{ items, pagination }`.',
    },
    servers: [{ url: env.API_BASE_URL, description: 'Configured via API_BASE_URL' }],
    tags: [
      'Auth', 'Users', 'Water', 'Sleep', 'Habits', 'Routines', 'Reminders', 'Steps', 'Activities',
      'Calendar', 'Notifications', 'Config', 'Holidays', 'Sync', 'Guest', 'Admin',
    ].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'Operation successful' }, data: { type: 'object' } },
        },
        Pagination: {
          type: 'object',
          properties: { page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 20 }, total: { type: 'integer', example: 100 }, totalPages: { type: 'integer', example: 5 } },
        },
        PaginatedEnvelope: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: { items: { type: 'array', items: { type: 'object' } }, pagination: { $ref: '#/components/schemas/Pagination' } },
            },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'message', 'error'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR', description: 'VALIDATION_ERROR, UNAUTHORIZED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR ...' },
                details: { type: 'object' },
              },
            },
            requestId: { type: 'string' },
          },
        },
      },
    },
  };
}
