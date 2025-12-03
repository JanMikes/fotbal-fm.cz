'use client';

import { useEffect, useState, useCallback } from 'react';
import { Comment } from '@/types/comment';
import CommentForm from '@/components/forms/CommentForm';
import CommentItem from '@/components/CommentItem';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CommentSectionProps {
  entityType: 'matchResult' | 'tournament' | 'event';
  entityId: string;
  currentUserId: number;
}

export default function CommentSection({
  entityType,
  entityId,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiPath = {
    matchResult: 'match-results',
    tournament: 'tournaments',
    event: 'events',
  }[entityType];

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/${apiPath}/${entityId}/comments`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Nepodařilo se načíst komentáře');
        return;
      }

      setComments(result.comments);
      setError(null);
    } catch {
      setError('Nepodařilo se načíst komentáře');
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCommentAdded = () => {
    fetchComments();
  };

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary">Komentáře</h2>

      <CommentForm
        entityType={entityType}
        entityId={entityId}
        onSuccess={handleCommentAdded}
      />

      {error && (
        <p className="text-danger">{error}</p>
      )}

      {comments.length === 0 ? (
        <p className="text-text-muted py-4">Zatím žádné komentáře</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              entityType={entityType}
              entityId={entityId}
              currentUserId={currentUserId}
              onReplyAdded={handleCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
