import type { Core } from '@strapi/strapi';

/**
 * Czech labels, hints and read-only flags for content-manager edit forms.
 *
 * The content manager keeps field labels/descriptions in the core store (per environment), not in
 * schema.json, so they are applied on boot. A field is (re)written only while its label is still the
 * Strapi default (the attribute name) or the label we set ourselves — a label an admin changed by hand
 * in "Nastavit zobrazení" is left alone. Changing a text below therefore reaches every environment on
 * the next boot.
 */
export interface FieldHint {
  label: string;
  /** Shorter label for the list view; defaults to `label`. */
  listLabel?: string;
  description?: string;
  placeholder?: string;
  /** false = shown read-only in the form. */
  editable?: boolean;
}

export const DEEP_LINK_FIELD_HINTS: Record<string, FieldHint> = {
  name: {
    label: 'Název',
    description: 'Jen pro orientaci v administraci, uživatelé ho neuvidí.',
    placeholder: 'např. Rodiče U9 – jaro 2027',
  },
  code: {
    label: 'Kód odkazu',
    description:
      'Nechte prázdné a kód se po uložení vygeneruje sám. Nebo zadejte vlastní, např. FOTBALFM → odkaz fotbal-fm.cz/a/FOTBALFM. Jen písmena A–Z a číslice, 4–16 znaků. Pozor: změnou kódu přestane fungovat už rozeslaný odkaz.',
    placeholder: 'prázdné = vygeneruje se',
  },
  url: {
    label: 'Odkaz ke sdílení',
    listLabel: 'Odkaz',
    description: 'Vyplní se sám po uložení. Tento odkaz zkopírujte a pošlete lidem.',
    editable: false,
  },
  audienceCategories: {
    label: 'Cílové skupiny',
    description: 'Do těchto skupin se zařadí každý, kdo se přes odkaz zaregistruje nebo přihlásí v aplikaci.',
  },
  active: {
    label: 'Aktivní',
    description: 'NE = odkaz přestane fungovat. Lze ho kdykoli znovu zapnout.',
  },
  expiresAt: {
    label: 'Platnost do',
    description: 'Nepovinné. Po tomto okamžiku odkaz přestane fungovat. Prázdné = platí bez omezení.',
  },
  claimsCount: {
    label: 'Počet použití',
    listLabel: 'Použito',
    description: 'Počítá se samo.',
    editable: false,
  },
  createdByUser: {
    label: 'Vytvořil uživatel aplikace',
    listLabel: 'Vytvořil',
    description: 'Vyplní se samo u pozvánek z aplikace („Pozvat přítele“). U odkazů z administrace zůstane prázdné.',
    editable: false,
  },
  claims: {
    label: 'Kdo odkaz použil',
    description: 'Zapisuje se samo při registraci nebo přihlášení přes odkaz.',
    editable: false,
  },
};

type Metadatas = Record<string, { edit?: Record<string, unknown>; list?: Record<string, unknown> }>;

/** Pure part: returns the new metadatas, or null when nothing changes. */
export function applyFieldHints(metadatas: Metadatas, hints: Record<string, FieldHint>): Metadatas | null {
  let changed = false;
  const next: Metadatas = { ...metadatas };

  for (const [field, hint] of Object.entries(hints)) {
    const current = metadatas[field];
    if (!current?.edit) continue;
    const label = current.edit.label;
    if (label !== field && label !== hint.label) continue; // customised by an admin

    const edit = {
      ...current.edit,
      label: hint.label,
      ...(hint.description !== undefined && { description: hint.description }),
      ...(hint.placeholder !== undefined && { placeholder: hint.placeholder }),
      ...(hint.editable !== undefined && { editable: hint.editable }),
    };
    const list = current.list ? { ...current.list, label: hint.listLabel ?? hint.label } : current.list;

    if (JSON.stringify(edit) !== JSON.stringify(current.edit) || JSON.stringify(list) !== JSON.stringify(current.list)) {
      next[field] = { ...current, edit, list };
      changed = true;
    }
  }

  return changed ? next : null;
}

export async function setFieldHints(strapi: Core.Strapi, uid: string, hints: Record<string, FieldHint>) {
  // store.get/set prefix the key with `<type>_<name>_`, so pass them separately.
  const storeParams = { type: 'plugin', name: 'content_manager', key: `configuration_content_types::${uid}` };
  const config = (await strapi.store.get(storeParams)) as { metadatas?: Metadatas } | null;
  if (!config?.metadatas) return;

  const metadatas = applyFieldHints(config.metadatas, hints);
  if (!metadatas) return;

  await strapi.store.set({ ...storeParams, value: { ...config, metadatas } });
  strapi.log.info(`Set field hints for ${uid}`);
}
