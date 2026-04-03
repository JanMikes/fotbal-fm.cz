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
import { eventsRoute } from './routes/events.js';
import { matchesRoute } from './routes/matches.js';
import { standingsRoute } from './routes/standings.js';
import { playersRoute } from './routes/players.js';
import { newsRoute } from './routes/news.js';
import { partnersRoute } from './routes/partners.js';
import { formsRoute } from './routes/forms.js';
import { navigationPagesRoute } from './routes/navigation-pages.js';

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
app.route('/api/v1', eventsRoute);
app.route('/api/v1', matchesRoute);
app.route('/api/v1', standingsRoute);
app.route('/api/v1', playersRoute);
app.route('/api/v1', newsRoute);
app.route('/api/v1', partnersRoute);
app.route('/api/v1', formsRoute);
app.route('/api/v1', navigationPagesRoute);

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
