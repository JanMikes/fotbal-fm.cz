import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { categoriesRoute } from './routes/categories.js';
import {
  authLoginRoute,
  authRegisterRoute,
  authChangePasswordRoute,
  authCloseAccountRoute,
  authForgotPasswordRoute,
  authResetPasswordRoute,
} from './routes/auth.js';

export const app = new OpenAPIHono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Register API routes
app.route('/api/v1', categoriesRoute);
app.route('/api/v1', authLoginRoute);
app.route('/api/v1', authRegisterRoute);
app.route('/api/v1', authChangePasswordRoute);
app.route('/api/v1', authCloseAccountRoute);
app.route('/api/v1', authForgotPasswordRoute);
app.route('/api/v1', authResetPasswordRoute);

// OpenAPI spec
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'FK Frydek-Mistek API',
    version: '0.1.0',
  },
});

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));
