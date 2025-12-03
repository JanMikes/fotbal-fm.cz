'use client';

import { useState } from 'react';
import { Comment } from '@/types/comment';
import CommentForm from '@/components/forms/CommentForm';
import Button from '@/components/ui/Button';

interface CommentItemProps {
  comment: Comment;
  entityType: 'matchResult' | 'tournament' | 'event';
  entityId: string;
  currentUserId: number;
  onReplyAdded: () => void;
  depth?: number;
}

export default function CommentItem({
  comment,
  entityType,
  entityId,
  currentUserId,
  onReplyAdded,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const isOwn = comment.author.id === currentUserId;

  const date = new Date(comment.createdAt);
  const formattedDate = date.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleReplySuccess = () => {
    setIsReplying(false);
    onReplyAdded();
  };

  const maxDepth = 2;

  return (
    <div
      className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-border' : ''}`}
    >
      <div
        className={`p-4 rounded-lg ${
          isOwn
            ? 'bg-primary/10 border border-primary/30'
            : 'bg-surface-elevated border border-border'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="font-medium text-text-primary">
              {comment.author.firstName} {comment.author.lastName}
            </span>
            {isOwn && (
              <span className="ml-2 text-xs text-primary font-medium">(Vy)</span>
            )}
          </div>
          <span className="text-xs text-text-muted whitespace-nowrap">
            {formattedDate} {formattedTime}
          </span>
        </div>

        <p className="text-text-secondary whitespace-pre-wrap">{comment.content}</p>

        {depth < maxDepth && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsReplying(!isReplying)}
            className="mt-2"
          >
            {isReplying ? 'Zrušit odpověď' : 'Odpovědět'}
          </Button>
        )}
      </div>

      {isReplying && (
        <div className="mt-3 ml-6">
          <CommentForm
            entityType={entityType}
            entityId={entityId}
            parentCommentId={comment.documentId}
            onSuccess={handleReplySuccess}
            onCancel={() => setIsReplying(false)}
            placeholder="Napište odpověď..."
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entityType={entityType}
              entityId={entityId}
              currentUserId={currentUserId}
              onReplyAdded={onReplyAdded}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
