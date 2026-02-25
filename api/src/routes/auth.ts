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

const RegisterBodySchema = z.object({
  username: z.string().min(3, 'Uživatelské jméno musí mít alespoň 3 znaky').openapi({ example: 'johndoe' }),
  email: z.string().email('Neplatný formát e-mailu').openapi({ example: 'john@example.com' }),
  password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků').openapi({ example: 'password123' }),
});

const registerRoute = createRoute({
  method: 'post',
  path: '/auth/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterBodySchema,
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
      description: 'Registration successful',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Registration failed (e.g. duplicate email/username)',
    },
  },
});

export const authLoginRoute = new OpenAPIHono();
export const authRegisterRoute = new OpenAPIHono();

authLoginRoute.openapi(route, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/local',
      body,
    );

    return c.json(result);
  } catch (err) {
    return c.json({ error: 'Neplatné přihlašovací údaje' }, 401);
  }
});

authRegisterRoute.openapi(registerRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/local/register',
      body,
    );

    return c.json(result);
  } catch (err) {
    let message = 'Registrace se nezdařila';
    try {
      const parsed = JSON.parse((err as Error).message);
      const strapiMessage = parsed?.error?.message;
      if (strapiMessage === 'Email or Username are already taken') {
        message = 'E-mail nebo uživatelské jméno je již zaregistrováno';
      }
    } catch {
      // keep default message
    }

    return c.json({ error: message }, 400);
  }
});
