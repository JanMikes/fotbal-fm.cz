'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileDown, Clock, Calendar } from 'lucide-react';
import Badge from '../ui/Badge';
import { MarkdownContent } from '../ui/MarkdownContent';
import ImageLightbox from '../ui/ImageLightbox';
import type { NewsArticle, NewsArticleSummary } from '@/lib/types';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

interface ArticleDetailProps {
  article: NewsArticle;
  categorySlug?: string;
  sidebarArticles?: NewsArticleSummary[];
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function estimateReadingTime(content: string | null): number {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function SidebarCard({
  article,
  categorySlug,
}: {
  article: NewsArticleSummary;
  categorySlug?: string;
}) {
  const slug = article.categories[0]?.slug ?? categorySlug;
  const href = slug
    ? `/kategorie/${slug}/clanek/${article.slug}`
    : `/novinky/clanek/${article.slug}`;

  return (
    <Link href={href} className="group flex gap-3">
      {article.mainPhoto && (
        <div className="relative w-20 h-16 shrink-0 overflow-hidden">
          <Image
            src={article.mainPhoto.url}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="80px"
          />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary line-clamp-2 group-hover:text-accent transition-colors leading-snug">
          {article.title}
        </p>
        <p className="text-[11px] text-primary/40 mt-1">{formatDate(article.createdAt)}</p>
      </div>
    </Link>
  );
}

export default function ArticleDetail({
  article,
  categorySlug,
  sidebarArticles = [],
}: ArticleDetailProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const readingTime = estimateReadingTime(article.description);
  const hasSidebar = sidebarArticles.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1100px] mx-auto my-8 bg-white border border-primary/15 shadow-sm"
    >
      {/* Header: meta + title + image (full width) */}
      <div className="px-6 pt-6 flex flex-wrap items-center gap-3 text-sm text-primary/50">
        {article.newsArticleTypes.map((type) => (
          <Badge key={type.slug} variant="accent" className="mr-1">
            {type.name}
          </Badge>
        ))}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <time dateTime={article.createdAt}>{formatDate(article.createdAt)}</time>
        </div>
        <span>·</span>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{readingTime} min čtení</span>
        </div>
      </div>

      <h1 className="px-6 pt-4 pb-4 text-2xl md:text-3xl font-black text-primary uppercase leading-tight">
        {article.title}
      </h1>

      {article.mainPhoto && (
        <div className="relative aspect-[4/5] overflow-hidden mx-6 mb-6">
          <Image
            src={article.mainPhoto.url}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 1100px) 100vw, 1050px"
            priority
          />
        </div>
      )}

      {/* Content + Sidebar */}
      <div className={`grid grid-cols-1 ${hasSidebar ? 'lg:grid-cols-[1fr_280px]' : ''}`}>
        {/* Left: article content */}
        <div className={hasSidebar ? 'lg:border-r lg:border-primary/10' : ''}>
          <div className="px-6 py-8">
            {article.description && (
              <MarkdownContent
                content={article.description}
                className="prose-lg text-primary/80 mb-12
                  prose-headings:text-primary prose-headings:uppercase prose-headings:font-bold
                  prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-none"
              />
            )}

            {article.files.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl font-bold text-primary uppercase mb-4">Dokumenty</h2>
                <div className="space-y-2">
                  {article.files.map((file, index) => (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border border-primary/10 hover:border-accent/30 hover:bg-accent/5 transition-colors"
                    >
                      <FileDown className="w-5 h-5 text-accent shrink-0" />
                      <span className="text-primary/80 hover:text-accent transition-colors">
                        {file.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {article.video && (
              <div className="mb-12">
                <h2 className="text-xl font-bold text-primary uppercase mb-4">Video</h2>
                <div className="aspect-video">
                  <iframe
                    src={getYouTubeEmbedUrl(article.video)}
                    className="w-full h-full"
                    allowFullScreen
                    title="Video"
                  />
                </div>
              </div>
            )}
          </div>

          {article.gallery.length > 0 && (
            <div className="px-6 pb-8">
              <h2 className="text-xl font-bold text-primary uppercase mb-6">Galerie</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {article.gallery.map((image, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="relative aspect-square overflow-hidden group cursor-pointer"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <Image
                      src={image.url}
                      alt={image.alternativeText || article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </motion.div>
                ))}
              </div>
              {lightboxIndex !== null && (
                <ImageLightbox
                  images={article.gallery}
                  currentIndex={lightboxIndex}
                  onClose={() => setLightboxIndex(null)}
                  onNavigate={setLightboxIndex}
                />
              )}
            </div>
          )}
        </div>

        {/* Right: sticky sidebar */}
        {hasSidebar && (
          <div className="border-t lg:border-t-0 border-primary/10">
            <div className="lg:sticky lg:top-[146px] p-4">
              <h3 className="text-xs font-bold text-primary/40 uppercase tracking-wider mb-4">
                Další články
              </h3>
              <div className="flex flex-col gap-4">
                {sidebarArticles.map((related) => (
                  <SidebarCard
                    key={related.documentId}
                    article={related}
                    categorySlug={categorySlug}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}
