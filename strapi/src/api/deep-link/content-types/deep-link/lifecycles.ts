import { errors } from '@strapi/utils';
import {
  buildDeepLinkUrl,
  generateDeepLinkCode,
  isValidDeepLinkCode,
  normalizeDeepLinkCode,
} from '../../../../lib/deep-link';

const { ValidationError } = errors;
const MAX_GENERATION_ATTEMPTS = 10;

async function codeExists(code: string, excludeId?: number): Promise<boolean> {
  const existing = await strapi.db.query('api::deep-link.deep-link').findOne({
    where: { code },
    select: ['id'],
  });
  return Boolean(existing) && existing.id !== excludeId;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateDeepLinkCode();
    if (!(await codeExists(code))) return code;
  }
  throw new Error('Could not generate a unique deep-link code');
}

/**
 * Resolves the code an entry should end up with: a blank code is auto-generated,
 * a typed one is normalized and validated. Returns undefined when `data` does not
 * touch the code at all (partial updates such as a claimsCount increment).
 */
async function resolveCode(data: Record<string, unknown>, existingId?: number): Promise<string | undefined> {
  if (!('code' in data)) return undefined;

  const raw = typeof data.code === 'string' ? data.code : '';
  if (raw.trim() === '') return generateUniqueCode();

  const code = normalizeDeepLinkCode(raw);
  if (!isValidDeepLinkCode(code)) {
    throw new ValidationError('Kód odkazu smí obsahovat jen písmena A–Z a číslice (4–16 znaků).');
  }
  if (await codeExists(code, existingId)) {
    throw new ValidationError(`Kód odkazu "${code}" už používá jiný odkaz.`);
  }
  return code;
}

export default {
  async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    const { data } = event.params;
    // The admin form sends code: null/"" for a new entry; the API never sends it.
    const code = (await resolveCode({ ...data, code: data.code ?? '' })) as string;
    data.code = code;
    data.url = buildDeepLinkUrl(code);
  },

  async beforeUpdate(event: { params: { data: Record<string, unknown>; where?: { id?: number } } }) {
    const { data, where } = event.params;
    const code = await resolveCode(data, where?.id);
    if (code !== undefined) {
      data.code = code;
      data.url = buildDeepLinkUrl(code);
    }
  },
};
