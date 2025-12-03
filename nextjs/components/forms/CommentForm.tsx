'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { commentSchema, CommentFormData } from '@/lib/validation';
import Button from '@/components/ui/Button';

interface CommentFormProps {
  entityType: 'matchResult' | 'tournament' | 'event';
  entityId: string;
  parentCommentId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export default function CommentForm({
  entityType,
  entityId,
  parentCommentId,
  onSuccess,
  onCancel,
  placeholder = 'Napište komentář...',
}: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit = async (data: CommentFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: data.content,
          [entityType]: entityId,
          ...(parentCommentId && { parentComment: parentCommentId }),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Nepodařilo se přidat komentář');
        return;
      }

      reset();
      onSuccess();
    } catch {
      setError('Nepodařilo se přidat komentář');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <textarea
          {...register('content')}
          placeholder={placeholder}
          rows={3}
          className={`w-full px-4 py-2.5 bg-surface border rounded-lg
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            transition-all duration-200 resize-none
            ${errors.content ? 'border-danger focus:ring-danger' : 'border-border hover:border-border-light'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isSubmitting}
        />
        {errors.content && (
          <p className="mt-1 text-sm text-danger">{errors.content.message}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Odesílám...' : parentCommentId ? 'Odpovědět' : 'Přidat komentář'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Zrušit
          </Button>
        )}
      </div>
    </form>
  );
}
