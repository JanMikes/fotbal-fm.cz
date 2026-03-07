/**
 * API utilities.
 * Re-exports all API helper functions and types.
 */

// Response utilities
export {
  apiSuccess,
  apiError,
  apiErrorFromAppError,
  handleApiError,
  ApiErrors,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from './response';

// Middleware
export {
  withAuth,
  withAuthJson,
  withAuthFormData,
  withErrorHandling,
  withJsonBody,
  addApiBreadcrumb,
  setFormContext,
  type AuthContext,
  type AuthContextWithFormData,
  type AuthContextWithJson,
  type AuthenticatedHandler,
  type AuthenticatedFormDataHandler,
  type AuthenticatedJsonHandler,
  type PublicHandler,
  type PublicJsonHandler,
} from './middleware';

// Logging utilities
export {
  formDataToLoggable,
  jsonBodyToLoggable,
  buildRequestContext,
  logFormDataSubmission,
  logJsonSubmission,
  setSentryFormContext,
  setSentryJsonContext,
  logErrorWithContext,
  captureErrorWithContext,
  type RequestLogContext,
} from './logging';

// FormData parsing
export {
  getStringField,
  getRequiredStringField,
  getNumberField,
  getRequiredNumberField,
  getBooleanField,
  getFiles,
  getDateField,
  getRequiredDateField,
  getTimeField,
  parseFormData,
  getFilledFields,
  type FieldDefinition,
} from './form-data';
