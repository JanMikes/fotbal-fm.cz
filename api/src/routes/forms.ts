import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  createFormToken,
  verifyFormToken,
  processFormData,
  buildEmailHtml,
  sendEmail,
  FormValidationError,
  type SmtpConfig,
} from '@fotbal-fm/form';
import { strapiGet } from '../lib/strapi.js';

// --- Config ---

const FORM_TOKEN_SECRET = process.env.FORM_TOKEN_SECRET || '';

const smtpConfig: SmtpConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  password: process.env.SMTP_PASSWORD || '',
  from: process.env.EMAIL_FROM || 'noreply@fotbal-fm.cz',
};

// --- Strapi raw types ---

interface StrapiRawInput {
  id: number;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date';
  placeholder: string | null;
  required: boolean;
  helpText: string | null;
  options: string | null;
  width: 'full' | 'half';
}

interface StrapiRawInputGroup {
  id: number;
  title: string | null;
  inputs: StrapiRawInput[];
}

interface StrapiRawFormDefinition {
  id: number;
  documentId: string;
  name: string;
  submitButtonText: string;
  successMessage: string;
  inputGroups: StrapiRawInputGroup[];
}

interface StrapiRawRecipient {
  id: number;
  email: string;
}

interface StrapiRawFormComponent {
  id: number;
  __component: 'components.form';
  form: StrapiRawFormDefinition | null;
  recipients: StrapiRawRecipient[];
}

interface StrapiRawPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: StrapiRawFormComponent[];
  sidebar: StrapiRawFormComponent[] | null;
}

// --- Zod schemas ---

const FormInputSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox', 'radio', 'file', 'date']),
  placeholder: z.string().nullable(),
  required: z.boolean(),
  helpText: z.string().nullable(),
  options: z.array(z.string()).nullable(),
  width: z.enum(['full', 'half']),
});

const FormInputGroupSchema = z.object({
  title: z.string().nullable(),
  inputs: z.array(FormInputSchema),
});

const FormWithTokenSchema = z.object({
  token: z.string(),
  form: z.object({
    documentId: z.string(),
    name: z.string(),
    submitButtonText: z.string(),
    successMessage: z.string(),
    inputGroups: z.array(FormInputGroupSchema),
  }),
});

// --- Helpers ---

function buildFormPopulate() {
  const formPopulate = {
    populate: {
      form: {
        populate: {
          inputGroups: {
            populate: { inputs: { populate: '*' } },
          },
        },
      },
      recipients: { populate: '*' },
    },
  };

  return {
    content: {
      on: { 'components.form': formPopulate },
    },
    sidebar: {
      on: { 'components.form': formPopulate },
    },
  };
}

function extractFormsFromPages(pages: StrapiRawPage[]) {
  const seen = new Set<string>();
  const forms: { token: string; form: z.infer<typeof FormWithTokenSchema>['form'] }[] = [];

  for (const page of pages) {
    const zones = [...(page.content || []), ...(page.sidebar || [])];

    for (const component of zones) {
      if (component.__component !== 'components.form') continue;
      if (!component.form) continue;

      const { form, recipients } = component;
      if (!recipients || recipients.length === 0) continue;

      // Deduplicate by form documentId (use first occurrence's recipients)
      if (seen.has(form.documentId)) continue;
      seen.add(form.documentId);

      const emails = recipients.map((r) => r.email);
      const token = createFormToken(emails, FORM_TOKEN_SECRET);

      forms.push({
        token,
        form: {
          documentId: form.documentId,
          name: form.name,
          submitButtonText: form.submitButtonText || 'Odeslat',
          successMessage: form.successMessage || 'Formulář byl úspěšně odeslán. Děkujeme!',
          inputGroups: (form.inputGroups || []).map((group) => ({
            title: group.title || null,
            inputs: (group.inputs || []).map((input) => ({
              name: input.name,
              label: input.label,
              type: input.type,
              placeholder: input.placeholder || null,
              required: input.required ?? false,
              helpText: input.helpText || null,
              options: input.options ? input.options.split('\n').filter(Boolean) : null,
              width: input.width || 'full',
            })),
          })),
        },
      });
    }
  }

  return forms;
}

// --- Rate limiting (in-memory) ---

const RATE_LIMIT_WINDOW = 600_000; // 10 minutes in ms
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000);

// --- Routes ---

const listRoute = createRoute({
  method: 'get',
  path: '/forms',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(FormWithTokenSchema),
          }),
        },
      },
      description: 'List of available forms with submission tokens',
    },
  },
});

export const formsRoute = new OpenAPIHono();

// GET /forms - list all available forms
formsRoute.openapi(listRoute, async (c) => {
  const result = await strapiGet<StrapiRawPage>('/pages', {
    fields: ['title', 'slug'],
    populate: buildFormPopulate(),
    pagination: { pageSize: 100 },
  });

  const forms = extractFormsFromPages(result.data);
  return c.json({ data: forms });
});

const submitRoute = createRoute({
  method: 'post',
  path: '/forms/submit',
  description: 'Submit a form with multipart/form-data. Include _token (from GET /forms) and _formName as fields. All other fields are sent as form data. File inputs are sent as attachments.',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            _token: z.string().optional().openapi({ description: 'Signed token from GET /forms response', example: 'eyJyIjpbI...' }),
            _formName: z.string().optional().openapi({ description: 'Name of the form being submitted', example: 'Kontaktní formulář' }),
          }).catchall(z.union([z.string(), z.any()])).openapi({
            description: 'Dynamic form fields plus optional file attachments. Fields _token and _formName are required. All other fields correspond to the form input names.',
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ data: z.object({ ok: z.boolean() }) }),
        },
      },
      description: 'Form submitted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Validation error or invalid token',
    },
    429: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Rate limit exceeded',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Server error',
    },
  },
});

// POST /forms/submit - submit form data (multipart/form-data)
formsRoute.openapi(submitRoute, async (c) => {
  try {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return c.json(
        { error: 'Příliš mnoho odeslaných formulářů. Zkuste to prosím později.' },
        429 as const,
      );
    }

    const body = await c.req.formData();

    const token = body.get('_token') as string | null;
    const formName = body.get('_formName') as string | null;

    if (!token || !formName) {
      return c.json({ error: 'Neplatný požadavek. Chybí _token nebo _formName.' }, 400 as const);
    }

    const recipients = verifyFormToken(token, FORM_TOKEN_SECRET);
    if (!recipients || recipients.length === 0) {
      return c.json({ error: 'Neplatný token.' }, 400 as const);
    }

    const { fields, attachments } = await processFormData(body);

    const html = buildEmailHtml(formName, fields, attachments.length);
    const success = await sendEmail(smtpConfig, {
      to: recipients,
      subject: `Nový formulář: ${formName}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!success) {
      return c.json(
        { error: 'Odeslání e-mailu se nezdařilo. Zkuste to prosím později.' },
        500 as const,
      );
    }

    return c.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof FormValidationError) {
      return c.json({ error: error.message }, 400 as const);
    }
    console.error('[Form Submit] Error:', error);
    return c.json({ error: 'Nastala neočekávaná chyba.' }, 500 as const);
  }
});
