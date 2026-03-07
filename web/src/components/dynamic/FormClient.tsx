'use client';

import { useState, useRef } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { FormDefinition, FormInput, FormInputGroup } from '@/lib/types';

interface FormClientProps {
  form: FormDefinition;
  token: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function FormClient({ form, token }: FormClientProps) {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    const formData = new FormData(e.currentTarget);
    formData.append('_token', token);
    formData.append('_formName', form.name);

    try {
      const response = await fetch('/api/form/submit', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Odeslání formuláře se nezdařilo.');
      }

      setStatus('success');
      formRef.current?.reset();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Odeslání formuláře se nezdařilo.');
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-white rounded-lg shadow-card p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <p className="text-primary text-lg">{form.successMessage}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-lg shadow-card p-6 md:p-8 space-y-6">
      {form.inputGroups.map((group, gi) => (
        <InputGroupRenderer key={gi} group={group} />
      ))}

      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {form.submitButtonText}
      </button>
    </form>
  );
}

function InputGroupRenderer({ group }: { group: FormInputGroup }) {
  return (
    <fieldset className="space-y-4">
      {group.title && (
        <legend className="text-lg font-semibold text-primary mb-2">{group.title}</legend>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {group.inputs.map((input, i) => (
          <div key={i} className={input.width === 'half' ? '' : 'md:col-span-2'}>
            <InputRenderer input={input} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function InputRenderer({ input }: { input: FormInput }) {
  const id = `form-field-${input.name}`;
  const baseClasses = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors';

  if (input.type === 'checkbox') {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name={input.name}
          required={input.required}
          value="true"
          className="mt-0.5 w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent/50"
        />
        <span className="text-sm text-primary">
          {input.label}
          {input.required && <span className="text-red-500 ml-1">*</span>}
          {input.helpText && <span className="block text-xs text-gray-500 mt-0.5">{input.helpText}</span>}
        </span>
      </label>
    );
  }

  const options = input.options?.split('\n').map(o => o.trim()).filter(Boolean) ?? [];

  if (input.type === 'radio') {
    return (
      <div>
        <span className="block text-sm font-medium text-primary mb-2">
          {input.label}
          {input.required && <span className="text-red-500 ml-1">*</span>}
        </span>
        <div className="space-y-2">
          {options.map((option, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={input.name}
                value={option}
                required={input.required}
                className="w-4 h-4 border-gray-300 text-accent focus:ring-accent/50"
              />
              <span className="text-sm text-primary">{option}</span>
            </label>
          ))}
        </div>
        {input.helpText && <p className="text-xs text-gray-500 mt-1">{input.helpText}</p>}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-primary mb-1">
        {input.label}
        {input.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {input.type === 'textarea' ? (
        <textarea
          id={id}
          name={input.name}
          placeholder={input.placeholder ?? undefined}
          required={input.required}
          rows={4}
          className={baseClasses}
        />
      ) : input.type === 'select' ? (
        <select
          id={id}
          name={input.name}
          required={input.required}
          className={baseClasses}
        >
          <option value="">{input.placeholder || 'Vyberte...'}</option>
          {options.map((option, i) => (
            <option key={i} value={option}>{option}</option>
          ))}
        </select>
      ) : input.type === 'file' ? (
        <input
          id={id}
          type="file"
          name={input.name}
          required={input.required}
          className="w-full text-sm text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent/10 file:text-accent file:font-medium hover:file:bg-accent/20 file:cursor-pointer cursor-pointer"
        />
      ) : (
        <input
          id={id}
          type={input.type}
          name={input.name}
          placeholder={input.placeholder ?? undefined}
          required={input.required}
          className={baseClasses}
        />
      )}

      {input.helpText && <p className="text-xs text-gray-500 mt-1">{input.helpText}</p>}
    </div>
  );
}
