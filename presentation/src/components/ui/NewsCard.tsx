'use client';

import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';
import Badge from './Badge';
import type { NewsArticleSummary } from '@/lib/types';
import { stripMarkdown } from '@/lib/markdown';

interface NewsCardProps {
  article: NewsArticleSummary;
  categorySlug: string;
  featured?: boolean;
  className?: string;
  hrefPrefix?: string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsCard({ article, categorySlug, featured = false, className, hrefPrefix }: NewsCardProps) {
  const href = hrefPrefix
    ? `${hrefPrefix}/clanek/${article.slug}`
    : `/kategorie/${categorySlug}/clanek/${article.slug}`;
  const imageUrl = article.mainPhoto?.url || '/news/news-1.jpg';
  if (featured) {
    return (
      <Link href={href} className="block">
        <article
          className={clsx(
            'relative group overflow-hidden cursor-pointer',
            'aspect-[4/3] md:aspect-[16/9] lg:aspect-[2/1]',
            className
          )}
        >
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-news" />
          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
            {(article.newsArticleTypes.length > 0 || article.categories.length > 0) && (
              <div className="flex flex-wrap gap-2 self-start mb-4">
                {article.categories.map((cat) => (
                  <Badge key={cat.slug} variant="dark">
                    {cat.name}
                  </Badge>
                ))}
                {article.newsArticleTypes.map((type) => (
                  <Badge key={type.slug} variant="accent">
                    {type.name}
                  </Badge>
                ))}
              </div>
            )}
            <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3 text-balance leading-tight">
              {article.title}
            </h3>
            {article.description && (
              <p className="text-white/80 text-body mb-4 line-clamp-2 max-w-2xl">
                {stripMarkdown(article.description).slice(0, 200)}
              </p>
            )}
            <div className="flex items-center gap-4 text-small text-white/60">
              <time dateTime={article.date}>{formatDate(article.date)}</time>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={href} className="block">
      <article
        className={clsx(
          'group bg-white overflow-hidden shadow-card card-lift cursor-pointer h-full',
          className
        )}
      >
        <div className="relative aspect-[4/5] overflow-hidden">
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-news" />
          {(article.newsArticleTypes.length > 0 || article.categories.length > 0) && (
            <div className="absolute top-4 left-4 flex flex-wrap gap-1">
              {article.categories.map((cat) => (
                <Badge key={cat.slug} variant="dark">
                  {cat.name}
                </Badge>
              ))}
              {article.newsArticleTypes.map((type) => (
                <Badge key={type.slug} variant="accent">
                  {type.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-bold text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors duration-300">
            {article.title}
          </h3>
          {article.description && (
            <p className="text-small text-primary/60 line-clamp-2 mb-4">
              {stripMarkdown(article.description).slice(0, 150)}
            </p>
          )}
          <div className="flex items-center gap-3 text-small text-primary/50">
            <time dateTime={article.date}>{formatDate(article.date)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}
