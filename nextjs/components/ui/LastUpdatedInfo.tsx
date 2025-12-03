import { UserInfo } from '@/types/match-result';

interface LastUpdatedInfoProps {
  updatedBy?: UserInfo;
  author?: UserInfo;
  updatedAt?: string;
  className?: string;
}

export default function LastUpdatedInfo({
  updatedBy,
  author,
  updatedAt,
  className = '',
}: LastUpdatedInfoProps) {
  // Only show if updatedBy exists and is different from author, or if there's been an update
  if (!updatedBy || !updatedAt) {
    return null;
  }

  // Skip if updatedBy is the same as author (initial creation)
  if (author && updatedBy.id === author.id) {
    return null;
  }

  const date = new Date(updatedAt);
  const formattedDate = date.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const fullName = `${updatedBy.firstName} ${updatedBy.lastName}`;

  return (
    <p className={`text-xs text-text-muted ${className}`}>
      Naposledy upravil(a) <span className="font-medium">{fullName}</span> dne{' '}
      {formattedDate} v {formattedTime}
    </p>
  );
}
