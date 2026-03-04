'use client';

import { motion } from 'framer-motion';
import { Newspaper } from 'lucide-react';
import { NewsCard } from '../ui';
import SectionHeader from '../ui/SectionHeader';
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
          <SectionHeader title="Novinky" icon={Newspaper} />
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
        <SectionHeader
          title="Novinky"
          icon={Newspaper}
          moreLink={`/kategorie/${categorySlug}/novinky`}
        />

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
