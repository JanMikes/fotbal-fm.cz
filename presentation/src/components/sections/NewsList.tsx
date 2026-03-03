'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { NewsCard } from '../ui';
import type { NewsArticleSummary } from '@/lib/types';

interface NewsListProps {
  articles: NewsArticleSummary[];
  categorySlug: string;
}

export default function NewsList({ articles, categorySlug }: NewsListProps) {
  if (articles.length === 0) {
    return (
      <section className="py-section bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-section text-primary uppercase accent-underline mb-4">
            Novinky
          </h2>
          <p className="text-body-lg text-primary/60">
            Zatím zde nejsou žádné novinky.
          </p>
        </div>
      </section>
    );
  }

  const featuredNews = articles[0];
  const otherNews = articles.slice(1, 6);

  return (
    <section className="py-section bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12"
        >
          <div>
            <h2 className="text-section text-primary uppercase accent-underline mb-4">
              Novinky
            </h2>
            <p className="text-body-lg text-primary/60 max-w-xl">
              Nejnovější zprávy, rozhovory a události z klubu.
            </p>
          </div>

          <Link
            href={`/kategorie/${categorySlug}/novinky`}
            className="inline-flex items-center gap-2 font-semibold uppercase tracking-wide text-sm px-6 py-3 rounded-full text-primary hover:bg-surface-light transition-all duration-300"
          >
            <span>Všechny novinky</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        {/* News Grid - Masonry Style */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Featured Article */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 lg:row-span-2"
          >
            <NewsCard article={featuredNews} categorySlug={categorySlug} featured />
          </motion.div>

          {/* Secondary Articles */}
          {otherNews.slice(0, 2).map((article, index) => (
            <motion.div
              key={article.documentId}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
              className="lg:col-span-5"
            >
              <NewsCard article={article} categorySlug={categorySlug} />
            </motion.div>
          ))}

          {/* Bottom Row */}
          {otherNews.slice(2, 5).map((article, index) => (
            <motion.div
              key={article.documentId}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="lg:col-span-4"
            >
              <NewsCard article={article} categorySlug={categorySlug} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
