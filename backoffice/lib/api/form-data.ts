/**
 * FormData parsing utilities for API routes.
 * Provides safe, validated parsing of form submissions.
 */

import { ValidationError } from '@/lib/core/errors';

/**
 * Safely get a string field from FormData
 * Returns undefined if the field is empty or not present
 */
export function getStringField(
  formData: FormData,
  name: string
): string | undefined {
  const value = formData.get(name);

  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Get a required string field from FormData
 * Throws ValidationError if missing or empty
 */
export function getRequiredStringField(
  formData: FormData,
  name: string,
  fieldLabel?: string
): string {
  const value = getStringField(formData, name);

  if (!value) {
    throw new ValidationError(
      `Pole "${fieldLabel ?? name}" je povinné`
    );
  }

  return value;
}

/**
 * Safely get a number field from FormData
 * Returns undefined if the field is empty, not present, or not a valid number
 */
export function getNumberField(
  formData: FormData,
  name: string
): number | undefined {
  const value = formData.get(name);

  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  const num = Number(trimmed);
  return isNaN(num) ? undefined : num;
}

/**
 * Get a required number field from FormData
 * Throws ValidationError if missing, empty, or not a valid number
 */
export function getRequiredNumberField(
  formData: FormData,
  name: string,
  fieldLabel?: string
): number {
  const value = getNumberField(formData, name);

  if (value === undefined) {
    throw new ValidationError(
      `Pole "${fieldLabel ?? name}" musí být vyplněno a obsahovat platné číslo`
    );
  }

  return value;
}

/**
 * Safely get a boolean field from FormData
 * Treats 'true', '1', 'on' as true, everything else as false
 */
export function getBooleanField(
  formData: FormData,
  name: string
): boolean {
  const value = formData.get(name);

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const lower = value.toLowerCase().trim();
  return lower === 'true' || lower === '1' || lower === 'on';
}

/**
 * Extract files from FormData for a specific field
 * Returns an array of File objects (empty array if no files)
 */
export function getFiles(
  formData: FormData,
  name: string
): File[] {
  const files: File[] = [];
  const entries = formData.getAll(name);

  for (const entry of entries) {
    if (entry instanceof File && entry.size > 0) {
      files.push(entry);
    }
  }

  return files;
}

/**
 * Parse a date field from FormData
 * Returns undefined if empty or invalid
 */
export function getDateField(
  formData: FormData,
  name: string
): string | undefined {
  const value = getStringField(formData, name);

  if (!value) {
    return undefined;
  }

  // Basic date format validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return undefined;
  }

  return value;
}

/**
 * Get a required date field from FormData
 */
export function getRequiredDateField(
  formData: FormData,
  name: string,
  fieldLabel?: string
): string {
  const value = getDateField(formData, name);

  if (!value) {
    throw new ValidationError(
      `Pole "${fieldLabel ?? name}" musí obsahovat platné datum`
    );
  }

  return value;
}

/**
 * Parse a time field from FormData
 * Returns undefined if empty or invalid
 */
export function getTimeField(
  formData: FormData,
  name: string
): string | undefined {
  const value = getStringField(formData, name);

  if (!value) {
    return undefined;
  }

  // Basic time format validation (HH:MM or HH:MM:SS)
  const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
  if (!timeRegex.test(value)) {
    return undefined;
  }

  return value;
}

/**
 * Parse all form fields using a definition object
 * Returns an object with parsed values
 */
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'files';
  required?: boolean;
  label?: string;
}

export function parseFormData<T extends Record<string, FieldDefinition>>(
  formData: FormData,
  fields: T
): { [K in keyof T]: T[K]['type'] extends 'files' ? File[] : T[K]['type'] extends 'boolean' ? boolean : T[K]['type'] extends 'number' ? (T[K]['required'] extends true ? number : number | undefined) : (T[K]['required'] extends true ? string : string | undefined) } {
  const result: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(fields)) {
    switch (def.type) {
      case 'string':
        result[name] = def.required
          ? getRequiredStringField(formData, name, def.label)
          : getStringField(formData, name);
        break;

      case 'number':
        result[name] = def.required
          ? getRequiredNumberField(formData, name, def.label)
          : getNumberField(formData, name);
        break;

      case 'boolean':
        result[name] = getBooleanField(formData, name);
        break;

      case 'date':
        result[name] = def.required
          ? getRequiredDateField(formData, name, def.label)
          : getDateField(formData, name);
        break;

      case 'time':
        result[name] = getTimeField(formData, name);
        break;

      case 'files':
        result[name] = getFiles(formData, name);
        break;
    }
  }

  return result as ReturnType<typeof parseFormData<T>>;
}

/**
 * Get list of field names that have values in FormData
 * Useful for Sentry context
 */
export function getFilledFields(formData: FormData): string[] {
  const filled: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) {
        filled.push(key);
      }
    } else if (typeof value === 'string' && value.trim() !== '') {
      filled.push(key);
    }
  }

  return [...new Set(filled)];
}
