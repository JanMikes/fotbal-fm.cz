import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiPost, strapiGetSingle, strapiDelete } from '../lib/strapi.js';
import { extractJwt } from '../middleware/auth.js';

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

// --- Change Password ---

const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().openapi({ example: 'oldPassword123' }),
  password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků').openapi({ example: 'newPassword123' }),
  passwordConfirmation: z.string().openapi({ example: 'newPassword123' }),
});

const changePasswordRoute = createRoute({
  method: 'post',
  path: '/auth/change-password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChangePasswordBodySchema,
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
      description: 'Password changed successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Password change failed',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized',
    },
  },
});

// --- Close Account ---

const CloseAccountBodySchema = z.object({
  password: z.string().openapi({ example: 'password123' }),
});

const OkResponseSchema = z.object({
  ok: z.boolean(),
});

const closeAccountRoute = createRoute({
  method: 'post',
  path: '/auth/close-account',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CloseAccountBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OkResponseSchema,
        },
      },
      description: 'Account deleted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Account deletion failed',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized or wrong password',
    },
  },
});

// --- Forgot Password ---

const ForgotPasswordBodySchema = z.object({
  email: z.string().email('Neplatný formát e-mailu').openapi({ example: 'user@example.com' }),
});

const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/auth/forgot-password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OkResponseSchema,
        },
      },
      description: 'Password reset email sent (always returns ok)',
    },
  },
});

// --- Reset Password ---

const ResetPasswordBodySchema = z.object({
  code: z.string().openapi({ example: 'abc123resetcode' }),
  password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků').openapi({ example: 'newPassword123' }),
  passwordConfirmation: z.string().openapi({ example: 'newPassword123' }),
});

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/auth/reset-password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordBodySchema,
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
      description: 'Password reset successful',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Password reset failed',
    },
  },
});

// --- Route Instances ---

export const authLoginRoute = new OpenAPIHono();
export const authRegisterRoute = new OpenAPIHono();
export const authChangePasswordRoute = new OpenAPIHono();
export const authCloseAccountRoute = new OpenAPIHono();
export const authForgotPasswordRoute = new OpenAPIHono();
export const authResetPasswordRoute = new OpenAPIHono();

authLoginRoute.openapi(route, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/local',
      body,
    );

    return c.json(result, 200);
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

    return c.json(result, 200);
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

// --- Change Password Handler ---

authChangePasswordRoute.openapi(changePasswordRoute, async (c) => {
  let jwt: string;
  try {
    jwt = extractJwt(c);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/change-password',
      body,
      jwt,
    );

    return c.json(result, 200);
  } catch (err) {
    let message = 'Změna hesla se nezdařila';
    try {
      const parsed = JSON.parse((err as Error).message);
      const strapiMessage = parsed?.error?.message;
      if (strapiMessage === 'The provided current password is invalid') {
        message = 'Zadané aktuální heslo je nesprávné';
      } else if (strapiMessage === 'Passwords do not match') {
        message = 'Hesla se neshodují';
      }
    } catch {
      // keep default message
    }

    return c.json({ error: message }, 400);
  }
});

// --- Close Account Handler ---

authCloseAccountRoute.openapi(closeAccountRoute, async (c) => {
  let jwt: string;
  try {
    jwt = extractJwt(c);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  const { password } = c.req.valid('json');

  // Step 1: Get current user via JWT
  let user: { id: number; email: string };
  try {
    user = await strapiGetSingle<{ id: number; email: string }>('/users/me', jwt);
  } catch {
    return c.json({ error: 'Neplatný nebo expirovaný token' }, 401);
  }

  // Step 2: Verify password via login
  try {
    await strapiPost('/auth/local', { identifier: user.email, password });
  } catch {
    return c.json({ error: 'Nesprávné heslo' }, 401);
  }

  // Step 3: Delete user (using API token)
  try {
    await strapiDelete(`/users/${user.id}`);
    return c.json({ ok: true }, 200);
  } catch {
    return c.json({ error: 'Smazání účtu se nezdařilo' }, 400);
  }
});

// --- Forgot Password Handler ---

authForgotPasswordRoute.openapi(forgotPasswordRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    await strapiPost('/auth/forgot-password', body);
  } catch {
    // Intentionally ignore errors to prevent email enumeration
  }

  return c.json({ ok: true }, 200);
});

// --- Reset Password Handler ---

authResetPasswordRoute.openapi(resetPasswordRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await strapiPost<{ jwt: string; user: { id: number; username: string; email: string } }>(
      '/auth/reset-password',
      body,
    );

    return c.json(result, 200);
  } catch (err) {
    let message = 'Obnovení hesla se nezdařilo';
    try {
      const parsed = JSON.parse((err as Error).message);
      const strapiMessage = parsed?.error?.message;
      if (strapiMessage === 'Incorrect code provided' || strapiMessage?.includes('code')) {
        message = 'Neplatný nebo expirovaný kód pro obnovení hesla';
      } else if (strapiMessage === 'Passwords do not match') {
        message = 'Hesla se neshodují';
      }
    } catch {
      // keep default message
    }

    return c.json({ error: message }, 400);
  }
});
