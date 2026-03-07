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

  return (
    <section className="py-section bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <SectionHeader
          title="Novinky"
          icon={Newspaper}
          moreLink={`/kategorie/${categorySlug}/novinky`}
        />

        {/* News Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {articles.slice(0, 5).map((article, index) => (
            <motion.div
              key={article.documentId}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <NewsCard article={article} categorySlug={categorySlug} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
