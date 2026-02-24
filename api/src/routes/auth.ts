import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiPost } from '../lib/strapi.js';

const LoginBodySchema = z.object({
  identifier: z.string().openapi({ example: 'user@example.com' }),
  password: z.string().openapi({ example: 'password123' }),
});

const LoginResponseSchema = z.object({
  jwt: z.string(),
  user: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'post',
  path: '/auth/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
      description: 'Login successful',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid credentials',
    },
  },
});

export const authLoginRoute = new OpenAPIHono();

authLoginRoute.openapi(route, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/local',
      body,
    );

    return c.json(result);
  } catch (err) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
});
