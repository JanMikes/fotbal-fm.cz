import { clsx } from 'clsx';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { ComponentAlert } from '@/lib/types';

interface AlertProps {
  data: ComponentAlert;
}

const variants = {
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: Info },
  success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: CheckCircle },
  warning: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: AlertTriangle },
  error: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: XCircle },
};

export function Alert({ data }: AlertProps) {
  if (!data.title && !data.text) return null;

  const variant = variants[data.type] || variants.info;
  const Icon = variant.icon;

  return (
    <div className={clsx('border rounded-lg p-4 flex gap-3', variant.bg)}>
      <Icon className={clsx('w-5 h-5 mt-0.5 shrink-0', variant.text)} />
      <div className={variant.text}>
        {data.title && <p className="font-semibold mb-1">{data.title}</p>}
        {data.text && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: data.text }}
          />
        )}
      </div>
    </div>
  );
}
