import type { ComponentForm } from '@/lib/types';
import { createFormToken } from '@/lib/form-token';
import { FormClient } from './FormClient';

interface FormBlockProps {
  data: ComponentForm;
}

export function FormBlock({ data }: FormBlockProps) {
  if (!data.form || data.recipients.length === 0) return null;

  const token = createFormToken(data.recipients);

  return (
    <FormClient
      form={data.form}
      token={token}
    />
  );
}
