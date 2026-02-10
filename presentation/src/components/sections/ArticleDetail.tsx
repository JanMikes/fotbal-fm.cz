'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Badge from '../ui/Badge';
import { NewsCard } from '../ui';
import type { NewsArticle } from '@/lib/types';

interface ArticleDetailProps {
  article: NewsArticle;
  categorySlug: string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ArticleDetail({ article, categorySlug }: ArticleDetailProps) {
  return (
    <article className="bg-white">
      {/* Hero Image */}
      {article.mainPhoto && (
        <div className="relative w-full aspect-[21/9] max-h-[500px]">
          <Image
            src={article.mainPhoto.url}
            alt={article.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-news" />
        </div>
      )}

      <div className="container mx-auto px-4 lg:px-8 py-12">
        {/* Back Link */}
        <Link
          href={`/${categorySlug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary/60 hover:text-accent transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět na novinky
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          {/* Type Badge */}
          {article.newsArticleType && (
            <Badge variant="accent" className="mb-4">
              {article.newsArticleType.name}
            </Badge>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary uppercase leading-tight mb-6">
            {article.title}
          </h1>

          {/* Date */}
          <div className="text-small text-primary/50 mb-8">
            <time dateTime={article.createdAt}>{formatDate(article.createdAt)}</time>
          </div>

          {/* Content */}
          {article.description && (
            <div
              className="prose prose-lg max-w-none text-primary/80 mb-12
                prose-headings:text-primary prose-headings:uppercase prose-headings:font-bold
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                prose-img:rounded-none"
              dangerouslySetInnerHTML={{ __html: article.description }}
            />
          )}

          {/* Video */}
          {article.video && (
            <div className="mb-12">
              <h2 className="text-xl font-bold text-primary uppercase mb-4">Video</h2>
              <div className="aspect-video">
                <iframe
                  src={article.video}
                  className="w-full h-full"
                  allowFullScreen
                  title="Video"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Gallery */}
        {article.gallery.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-primary uppercase mb-6">Galerie</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {article.gallery.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="relative aspect-square overflow-hidden group"
                >
                  <Image
                    src={image.url}
                    alt={image.alternativeText || article.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Related News */}
        {article.relatedNews.length > 0 && (
          <div className="mt-16 pt-12 border-t border-primary/10">
            <h2 className="text-xl font-bold text-primary uppercase mb-8">
              Související články
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {article.relatedNews.slice(0, 3).map((related) => (
                <NewsCard
                  key={related.documentId}
                  article={related}
                  categorySlug={categorySlug}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
