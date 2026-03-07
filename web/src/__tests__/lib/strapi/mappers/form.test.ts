import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
  },
}));

import { mapPage } from '@/lib/strapi/mappers/page';
import type { StrapiRawPage } from '@/lib/strapi/types';
import type { ComponentForm } from '@/lib/types';

describe('form component mapping', () => {
  it('maps form component with full data', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 200,
          __component: 'components.form',
          form: {
            documentId: 'form-1',
            name: 'Kontaktní formulář',
            submitButtonText: 'Odeslat zprávu',
            successMessage: 'Zpráva byla odeslána!',
            inputGroups: [
              {
                title: 'Osobní údaje',
                inputs: [
                  { name: 'name', label: 'Jméno', type: 'text', placeholder: 'Vaše jméno', required: true, helpText: null, options: null, width: 'half' },
                  { name: 'email', label: 'E-mail', type: 'email', placeholder: 'vas@email.cz', required: true, helpText: 'Zadejte platný e-mail', options: null, width: 'half' },
                ],
              },
              {
                title: null,
                inputs: [
                  { name: 'message', label: 'Zpráva', type: 'textarea', placeholder: 'Vaše zpráva...', required: true, helpText: null, options: null, width: 'full' },
                  { name: 'category', label: 'Kategorie', type: 'select', placeholder: null, required: false, helpText: null, options: 'Dotaz\nStížnost\nJiné', width: 'full' },
                ],
              },
            ],
          },
          recipients: [
            { email: 'admin@test.cz' },
            { email: 'info@test.cz' },
          ],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);

    const form = result.content[0] as ComponentForm;
    expect(form.__component).toBe('components.form');
    expect(form.form).not.toBeNull();
    expect(form.form!.documentId).toBe('form-1');
    expect(form.form!.name).toBe('Kontaktní formulář');
    expect(form.form!.submitButtonText).toBe('Odeslat zprávu');
    expect(form.form!.successMessage).toBe('Zpráva byla odeslána!');
    expect(form.form!.inputGroups).toHaveLength(2);
    expect(form.form!.inputGroups[0].title).toBe('Osobní údaje');
    expect(form.form!.inputGroups[0].inputs).toHaveLength(2);
    expect(form.form!.inputGroups[0].inputs[0].name).toBe('name');
    expect(form.form!.inputGroups[0].inputs[0].type).toBe('text');
    expect(form.form!.inputGroups[0].inputs[0].required).toBe(true);
    expect(form.form!.inputGroups[0].inputs[0].width).toBe('half');
    expect(form.form!.inputGroups[1].inputs[1].options).toBe('Dotaz\nStížnost\nJiné');
    expect(form.recipients).toEqual(['admin@test.cz', 'info@test.cz']);
  });

  it('maps form component with null form relation', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 201,
          __component: 'components.form',
          form: null,
          recipients: [],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const form = result.content[0] as ComponentForm;
    expect(form.form).toBeNull();
    expect(form.recipients).toEqual([]);
  });

  it('maps form with default values for missing fields', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 202,
          __component: 'components.form',
          form: {
            documentId: 'form-2',
            name: 'Simple form',
            inputGroups: [
              {
                inputs: [
                  { name: 'field1', label: 'Field 1' },
                ],
              },
            ],
          },
          recipients: [{ email: 'test@test.cz' }],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const form = result.content[0] as ComponentForm;
    expect(form.form!.submitButtonText).toBe('Odeslat');
    expect(form.form!.successMessage).toBe('Formulář byl úspěšně odeslán. Děkujeme!');
    expect(form.form!.inputGroups[0].title).toBeNull();
    expect(form.form!.inputGroups[0].inputs[0].type).toBe('text');
    expect(form.form!.inputGroups[0].inputs[0].required).toBe(false);
    expect(form.form!.inputGroups[0].inputs[0].width).toBe('full');
  });
});
