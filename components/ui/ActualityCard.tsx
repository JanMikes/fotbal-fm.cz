import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import type { Actuality } from '@/types';

interface ActualityCardProps {
  actuality: Actuality;
}

export default function ActualityCard({ actuality }: ActualityCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Link
      href={`/${actuality.category}/aktuality/${actuality.id}`}
      className="block bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-primary to-secondary overflow-hidden">
        {actuality.image ? (
          <img
            src={actuality.image}
            alt={actuality.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30 text-4xl font-bold">FM</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Calendar className="w-4 h-4" />
          <time dateTime={actuality.date}>{formatDate(actuality.date)}</time>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-secondary transition-colors">
          {actuality.title}
        </h3>

        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {actuality.excerpt}
        </p>

        <div className="flex items-center text-secondary font-semibold group-hover:gap-2 transition-all">
          Číst více
          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
