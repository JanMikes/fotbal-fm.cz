'use client';

import Image from 'next/image';
import { clsx } from 'clsx';
import Badge from './Badge';
import { NewsArticle } from '@/data/mockData';

interface NewsCardProps {
  article: NewsArticle;
  featured?: boolean;
  className?: string;
}

export default function NewsCard({ article, featured = false, className }: NewsCardProps) {
  if (featured) {
    return (
      <article
        className={clsx(
          'relative group overflow-hidden cursor-pointer',
          'aspect-[4/3] md:aspect-[16/9] lg:aspect-[2/1]',
          className
        )}
      >
        {/* Background Image */}
        <Image
          src={article.image}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-news" />

        {/* Content */}
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
          <Badge variant="accent" className="self-start mb-4">
            {article.category}
          </Badge>

          <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3 text-balance leading-tight">
            {article.title}
          </h3>

          <p className="text-white/80 text-body mb-4 line-clamp-2 max-w-2xl">
            {article.excerpt}
          </p>

          <div className="flex items-center gap-4 text-small text-white/60">
            <time dateTime={article.dateISO}>{article.date}</time>
            <span>&bull;</span>
            <span>{article.readTime} min</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={clsx(
        'group bg-white overflow-hidden shadow-card card-lift cursor-pointer',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-news-card overflow-hidden">
        <Image
          src={article.image}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-news" />
        <Badge variant="accent" className="absolute top-4 left-4">
          {article.category}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors duration-300">
          {article.title}
        </h3>

        <p className="text-small text-primary/60 line-clamp-2 mb-4">
          {article.excerpt}
        </p>

        <div className="flex items-center gap-3 text-small text-primary/50">
          <time dateTime={article.dateISO}>{article.date}</time>
          <span>&bull;</span>
          <span>{article.readTime} min</span>
        </div>
      </div>
    </article>
  );
}
