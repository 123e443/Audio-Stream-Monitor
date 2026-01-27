import { z } from 'zod';
import { insertStreamSchema, streams, transcriptions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  streams: {
    list: {
      method: 'GET' as const,
      path: '/api/streams',
      responses: {
        200: z.array(z.custom<typeof streams.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/streams/:id',
      responses: {
        200: z.custom<typeof streams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/streams',
      input: insertStreamSchema,
      responses: {
        201: z.custom<typeof streams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/streams/:id/status',
      input: z.object({ status: z.enum(['active', 'inactive', 'error']) }),
      responses: {
        200: z.custom<typeof streams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/streams/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  transcriptions: {
    list: {
      method: 'GET' as const,
      path: '/api/streams/:id/transcriptions',
      input: z.object({
        limit: z.coerce.number().optional().default(50),
        cursor: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof transcriptions.$inferSelect>()),
      },
    },
    all: {
      method: 'GET' as const,
      path: '/api/transcriptions',
      input: z.object({
        limit: z.coerce.number().optional().default(100),
        withLocation: z.coerce.boolean().optional().default(false),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof transcriptions.$inferSelect>()),
      },
    },
  }
};

export const ws = {
  receive: {
    transcription: z.object({
      streamId: z.number(),
      content: z.string(),
      timestamp: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      address: z.string().optional(),
      callType: z.string().optional(),
    })
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
