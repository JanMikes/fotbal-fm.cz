import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr',
  '.js', '.vbs', '.wsf', '.jar', '.py', '.rb', '.php',
]);

export interface FormField {
  name: string;
  value: string;
}

export interface FormAttachment {
  filename: string;
  content: Buffer;
}

export interface ProcessedFormData {
  fields: FormField[];
  attachments: FormAttachment[];
}

export class FormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormValidationError';
  }
}

/**
 * Process FormData entries into fields and attachments.
 * Skips keys starting with '_' (reserved for internal use).
 * Validates file size and extension.
 * Throws FormValidationError on validation failures.
 */
export async function processFormData(formData: FormData): Promise<ProcessedFormData> {
  const fields: FormField[] = [];
  const attachments: FormAttachment[] = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('_')) continue;

    if (value instanceof File && value.size > 0) {
      if (value.size > MAX_FILE_SIZE) {
        throw new FormValidationError(
          `Soubor "${escapeHtml(value.name)}" je příliš velký (max 10 MB).`,
        );
      }

      const ext = path.extname(value.name).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        throw new FormValidationError(`Typ souboru "${ext}" není povolen.`);
      }

      const buffer = Buffer.from(await value.arrayBuffer());
      attachments.push({ filename: path.basename(value.name), content: buffer });
    } else if (typeof value === 'string') {
      fields.push({ name: key, value });
    }
  }

  if (fields.length === 0 && attachments.length === 0) {
    throw new FormValidationError('Formulář je prázdný.');
  }

  return { fields, attachments };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function buildEmailHtml(
  formName: string,
  fields: FormField[],
  attachmentCount: number,
): string {
  const rows = fields
    .map(
      (f) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; white-space: nowrap; vertical-align: top;">${escapeHtml(f.name)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${escapeHtml(f.value).replace(/\n/g, '<br>')}</td>
        </tr>`,
    )
    .join('');

  const attachmentNote =
    attachmentCount > 0
      ? `<p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Přílohy: ${attachmentCount} soubor${attachmentCount > 1 ? 'y' : ''}</p>`
      : '';

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #1e40af; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${escapeHtml(formName)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Odesláno: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</p>
      </div>
      <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${rows}
        </table>
        ${attachmentNote}
      </div>
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">Fotbal FM - automatická notifikace</p>
    </div>
  `;
}
