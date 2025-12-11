/**
 * API request logging utilities.
 * Provides structured logging for form submissions to stdout and Sentry.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Fields that should never be logged (contain sensitive data)
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'credit_card',
  'creditCard',
  'cvv',
  'ssn',
]);

/**
 * Fields that should be partially masked (show first/last chars)
 */
const MASK_PARTIAL_FIELDS = new Set([
  'email',
]);

/**
 * Maximum length for string values in logs
 */
const MAX_STRING_LENGTH = 500;

/**
 * Maximum number of array items to log
 */
const MAX_ARRAY_ITEMS = 10;

/**
 * Sanitize a single value for logging
 */
function sanitizeValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();

  // Check if field is sensitive
  if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
    return '[REDACTED]';
  }

  // Check if field should be partially masked
  if (MASK_PARTIAL_FIELDS.has(key) || MASK_PARTIAL_FIELDS.has(lowerKey)) {
    if (typeof value === 'string' && value.length > 4) {
      return `${value.slice(0, 2)}***${value.slice(-2)}`;
    }
  }

  // Handle different types
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.slice(0, MAX_STRING_LENGTH)}... [truncated, ${value.length} chars total]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const truncated = value.slice(0, MAX_ARRAY_ITEMS);
    const sanitized = truncated.map((item, index) => sanitizeValue(String(index), item));
    if (value.length > MAX_ARRAY_ITEMS) {
      return [...sanitized, `... and ${value.length - MAX_ARRAY_ITEMS} more items`];
    }
    return sanitized;
  }

  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return String(value);
}

/**
 * Sanitize an object for logging (removes sensitive fields, truncates long values)
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}

/**
 * Extract file metadata from a File object (without the actual content)
 */
function getFileMetadata(file: File): Record<string, unknown> {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    sizeFormatted: formatFileSize(file.size),
  };
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Convert FormData to a loggable object
 */
export function formDataToLoggable(formData: FormData): {
  fields: Record<string, unknown>;
  files: Array<Record<string, unknown>>;
  summary: {
    fieldCount: number;
    fileCount: number;
    totalFileSize: number;
    fieldNames: string[];
  };
} {
  const fields: Record<string, unknown> = {};
  const files: Array<Record<string, unknown>> = [];
  let totalFileSize = 0;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const metadata = getFileMetadata(value);
      files.push({ fieldName: key, ...metadata });
      totalFileSize += value.size;
    } else {
      // Handle multiple values for same key
      if (key in fields) {
        const existing = fields[key];
        if (Array.isArray(existing)) {
          existing.push(sanitizeValue(key, value));
        } else {
          fields[key] = [existing, sanitizeValue(key, value)];
        }
      } else {
        fields[key] = sanitizeValue(key, value);
      }
    }
  }

  return {
    fields,
    files,
    summary: {
      fieldCount: Object.keys(fields).length,
      fileCount: files.length,
      totalFileSize,
      fieldNames: [...formData.keys()],
    },
  };
}

/**
 * Convert JSON body to a loggable object
 */
export function jsonBodyToLoggable(body: unknown): {
  data: unknown;
  summary: {
    type: string;
    fieldCount?: number;
    fieldNames?: string[];
  };
} {
  if (body === null || body === undefined) {
    return {
      data: body,
      summary: { type: 'null' },
    };
  }

  if (typeof body !== 'object') {
    return {
      data: sanitizeValue('body', body),
      summary: { type: typeof body },
    };
  }

  if (Array.isArray(body)) {
    return {
      data: body.slice(0, MAX_ARRAY_ITEMS).map((item, index) =>
        sanitizeValue(String(index), item)
      ),
      summary: {
        type: 'array',
        fieldCount: body.length,
      },
    };
  }

  const sanitized = sanitizeObject(body as Record<string, unknown>);
  return {
    data: sanitized,
    summary: {
      type: 'object',
      fieldCount: Object.keys(body).length,
      fieldNames: Object.keys(body),
    },
  };
}

/**
 * Request metadata for logging
 */
export interface RequestLogContext {
  url: string;
  method: string;
  path: string;
  userId?: number;
  userEmail?: string;
  timestamp: string;
  requestId: string;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build request context from NextRequest
 */
export function buildRequestContext(
  request: Request,
  userId?: number,
  userEmail?: string
): RequestLogContext {
  const url = new URL(request.url);
  return {
    url: request.url,
    method: request.method,
    path: url.pathname,
    userId,
    userEmail: userEmail ? sanitizeValue('email', userEmail) as string : undefined,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  };
}

/**
 * Log FormData submission to stdout
 */
export function logFormDataSubmission(
  context: RequestLogContext,
  formData: FormData,
  handlerName: string
): void {
  const loggable = formDataToLoggable(formData);

  console.log('=== FORM SUBMISSION ===');
  console.log('[Request ID]', context.requestId);
  console.log('[Timestamp]', context.timestamp);
  console.log('[Handler]', handlerName);
  console.log('[Method]', context.method);
  console.log('[Path]', context.path);
  console.log('[User ID]', context.userId ?? 'anonymous');
  console.log('[User Email]', context.userEmail ?? 'anonymous');
  console.log('[Summary]', JSON.stringify(loggable.summary));
  console.log('[Fields]', JSON.stringify(loggable.fields, null, 2));
  if (loggable.files.length > 0) {
    console.log('[Files]', JSON.stringify(loggable.files, null, 2));
  }
  console.log('=== END FORM SUBMISSION ===');
}

/**
 * Log JSON body submission to stdout
 */
export function logJsonSubmission(
  context: RequestLogContext,
  body: unknown,
  handlerName: string
): void {
  const loggable = jsonBodyToLoggable(body);

  console.log('=== JSON SUBMISSION ===');
  console.log('[Request ID]', context.requestId);
  console.log('[Timestamp]', context.timestamp);
  console.log('[Handler]', handlerName);
  console.log('[Method]', context.method);
  console.log('[Path]', context.path);
  console.log('[User ID]', context.userId ?? 'anonymous');
  console.log('[User Email]', context.userEmail ?? 'anonymous');
  console.log('[Summary]', JSON.stringify(loggable.summary));
  console.log('[Body]', JSON.stringify(loggable.data, null, 2));
  console.log('=== END JSON SUBMISSION ===');
}

/**
 * Set Sentry context with form data
 */
export function setSentryFormContext(
  context: RequestLogContext,
  formData: FormData,
  handlerName: string
): void {
  const loggable = formDataToLoggable(formData);

  // Set user context if available
  if (context.userId) {
    Sentry.setUser({
      id: String(context.userId),
      email: context.userEmail,
    });
  }

  // Set request context
  Sentry.setContext('request', {
    requestId: context.requestId,
    url: context.url,
    method: context.method,
    path: context.path,
    handler: handlerName,
    timestamp: context.timestamp,
  });

  // Set form data context
  Sentry.setContext('form_data', {
    summary: loggable.summary,
    fields: loggable.fields,
  });

  // Set files context separately (can be large)
  if (loggable.files.length > 0) {
    Sentry.setContext('form_files', {
      count: loggable.files.length,
      totalSize: loggable.summary.totalFileSize,
      totalSizeFormatted: formatFileSize(loggable.summary.totalFileSize),
      files: loggable.files,
    });
  }

  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'form_submission',
    message: `Form submitted to ${context.path}`,
    level: 'info',
    data: {
      handler: handlerName,
      fieldCount: loggable.summary.fieldCount,
      fileCount: loggable.summary.fileCount,
      fieldNames: loggable.summary.fieldNames,
    },
  });
}

/**
 * Set Sentry context with JSON body
 */
export function setSentryJsonContext(
  context: RequestLogContext,
  body: unknown,
  handlerName: string
): void {
  const loggable = jsonBodyToLoggable(body);

  // Set user context if available
  if (context.userId) {
    Sentry.setUser({
      id: String(context.userId),
      email: context.userEmail,
    });
  }

  // Set request context
  Sentry.setContext('request', {
    requestId: context.requestId,
    url: context.url,
    method: context.method,
    path: context.path,
    handler: handlerName,
    timestamp: context.timestamp,
  });

  // Set request body context
  Sentry.setContext('request_body', {
    summary: loggable.summary,
    data: loggable.data,
  });

  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'json_submission',
    message: `JSON submitted to ${context.path}`,
    level: 'info',
    data: {
      handler: handlerName,
      ...loggable.summary,
    },
  });
}

/**
 * Log error with full context to stdout
 */
export function logErrorWithContext(
  context: RequestLogContext,
  error: unknown,
  handlerName: string,
  submissionData?: { type: 'form'; data: FormData } | { type: 'json'; data: unknown }
): void {
  console.error('=== API ERROR ===');
  console.error('[Request ID]', context.requestId);
  console.error('[Timestamp]', context.timestamp);
  console.error('[Handler]', handlerName);
  console.error('[Method]', context.method);
  console.error('[Path]', context.path);
  console.error('[User ID]', context.userId ?? 'anonymous');
  console.error('[User Email]', context.userEmail ?? 'anonymous');

  if (error instanceof Error) {
    console.error('[Error Type]', error.constructor.name);
    console.error('[Error Message]', error.message);
    console.error('[Error Stack]', error.stack);
  } else {
    console.error('[Error]', error);
  }

  if (submissionData) {
    if (submissionData.type === 'form') {
      const loggable = formDataToLoggable(submissionData.data);
      console.error('[Form Summary]', JSON.stringify(loggable.summary));
      console.error('[Form Fields]', JSON.stringify(loggable.fields, null, 2));
      if (loggable.files.length > 0) {
        console.error('[Form Files]', JSON.stringify(loggable.files, null, 2));
      }
    } else {
      const loggable = jsonBodyToLoggable(submissionData.data);
      console.error('[Body Summary]', JSON.stringify(loggable.summary));
      console.error('[Body Data]', JSON.stringify(loggable.data, null, 2));
    }
  }

  console.error('=== END API ERROR ===');
}

/**
 * Capture error to Sentry with full context
 */
export function captureErrorWithContext(
  context: RequestLogContext,
  error: unknown,
  handlerName: string,
  submissionData?: { type: 'form'; data: FormData } | { type: 'json'; data: unknown }
): void {
  const extra: Record<string, unknown> = {
    requestId: context.requestId,
    url: context.url,
    method: context.method,
    path: context.path,
    handler: handlerName,
  };

  if (submissionData) {
    if (submissionData.type === 'form') {
      const loggable = formDataToLoggable(submissionData.data);
      extra.formSummary = loggable.summary;
      extra.formFields = loggable.fields;
      extra.formFiles = loggable.files;
    } else {
      const loggable = jsonBodyToLoggable(submissionData.data);
      extra.bodySummary = loggable.summary;
      extra.bodyData = loggable.data;
    }
  }

  Sentry.captureException(error, {
    tags: {
      handler: handlerName,
      path: context.path,
      method: context.method,
      hasUser: context.userId ? 'true' : 'false',
    },
    extra,
  });
}
