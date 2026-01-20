'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { NewsCard } from '../ui';
import Button from '../ui/Button';
import { news } from '@/data/mockData';

export default function News() {
  const featuredNews = news[0];
  const otherNews = news.slice(1, 6);

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

          <Button
            variant="ghost"
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Všechny novinky
          </Button>
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
            <NewsCard article={featuredNews} featured />
          </motion.div>

          {/* Secondary Articles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <NewsCard article={otherNews[0]} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <NewsCard article={otherNews[1]} />
          </motion.div>

          {/* Bottom Row */}
          {otherNews.slice(2, 5).map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="lg:col-span-4"
            >
              <NewsCard article={article} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
