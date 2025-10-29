import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, ArrowLeft, User } from 'lucide-react';
import { getActuality, getCategoryName } from '@/lib/data';
import type { Category } from '@/types';
import type { Metadata } from 'next';

interface ActualityPageProps {
  params: Promise<{
    category: string;
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: ActualityPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const actuality = await getActuality(
    resolvedParams.category as Category,
    resolvedParams.id
  );

  if (!actuality) {
    return {
      title: 'Aktualita nenalezena | Frýdek-Místek Fotbal',
    };
  }

  return {
    title: `${actuality.title} | Frýdek-Místek Fotbal`,
    description: actuality.excerpt,
  };
}

export default async function ActualityPage({ params }: ActualityPageProps) {
  const resolvedParams = await params;
  const actuality = await getActuality(
    resolvedParams.category as Category,
    resolvedParams.id
  );

  if (!actuality) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-50 py-12">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href={`/${actuality.category}`}
          className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Zpět na {getCategoryName(actuality.category as Category)}
        </Link>

        {/* Article Header */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          {actuality.image && (
            <div className="relative h-96 bg-gradient-to-br from-primary to-secondary">
              <img
                src={actuality.image}
                alt={actuality.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8 md:p-12">
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-secondary" />
                <time dateTime={actuality.date}>{formatDate(actuality.date)}</time>
              </div>
              {actuality.author && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-secondary" />
                  <span>{actuality.author}</span>
                </div>
              )}
              <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-semibold">
                {getCategoryName(actuality.category as Category)}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {actuality.title}
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              {actuality.excerpt}
            </p>

            <div className="prose prose-lg max-w-none">
              {actuality.content.split('\n').map((paragraph, index) => (
                <p key={index} className="text-gray-700 mb-4 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Back Link Bottom */}
        <Link
          href={`/${actuality.category}`}
          className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Zpět na {getCategoryName(actuality.category as Category)}
        </Link>
      </article>
    </div>
  );
}
