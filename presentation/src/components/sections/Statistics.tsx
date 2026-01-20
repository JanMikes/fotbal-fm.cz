'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Trophy, Target, Users, TrendingUp } from 'lucide-react';

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ElementType;
  description: string;
}

const stats: StatItem[] = [
  {
    label: 'Pozice v tabulce',
    value: 3,
    suffix: '.',
    icon: Trophy,
    description: 'MSFL 2025/26',
  },
  {
    label: 'Odehraných zápasů',
    value: 15,
    icon: Target,
    description: 'v aktuální sezóně',
  },
  {
    label: 'Vstřelených gólů',
    value: 28,
    icon: TrendingUp,
    description: 'v aktuální sezóně',
  },
  {
    label: 'Hráčů v kádru',
    value: 24,
    icon: Users,
    description: 'A-tým muži',
  },
];

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref} className="number-display">
      {count}{suffix}
    </span>
  );
}

export default function Statistics() {
  return (
    <section className="relative py-section-sm bg-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23081E44' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-section text-primary uppercase mb-4">
            Sezóna v číslech
          </h2>
          <p className="text-body-lg text-primary/60 max-w-xl mx-auto">
            Aktuální statistiky A-týmu v Moravskoslezské fotbalové lize
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              <div className="bg-surface-light p-6 lg:p-8 text-center h-full transition-all duration-300 hover:bg-primary hover:shadow-card-hover group-hover:-translate-y-2">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent mb-4 transition-colors group-hover:bg-white/10 group-hover:text-white">
                  <stat.icon className="w-7 h-7" />
                </div>

                {/* Value */}
                <div className="text-4xl lg:text-5xl font-black text-primary mb-2 transition-colors group-hover:text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>

                {/* Label */}
                <h3 className="text-sm lg:text-base font-semibold text-primary uppercase tracking-wide mb-1 transition-colors group-hover:text-white">
                  {stat.label}
                </h3>

                {/* Description */}
                <p className="text-small text-primary/50 transition-colors group-hover:text-white/60">
                  {stat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* League Table Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-primary p-6 lg:p-8 overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                Moravskoslezská fotbalová liga
              </h3>
              <p className="text-white/60">
                Aktuální pozice v tabulce po 15. kole
              </p>
            </div>

            {/* Mini Table */}
            <div className="bg-white/5 overflow-hidden">
              <table className="w-full lg:w-auto text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Tým</th>
                    <th className="px-4 py-3 text-center">Z</th>
                    <th className="px-4 py-3 text-center">B</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/60">1.</td>
                    <td className="px-4 py-3 font-medium">FC Baník Ostrava B</td>
                    <td className="px-4 py-3 text-center">15</td>
                    <td className="px-4 py-3 text-center font-bold">36</td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/60">2.</td>
                    <td className="px-4 py-3 font-medium">SFC Opava</td>
                    <td className="px-4 py-3 text-center">15</td>
                    <td className="px-4 py-3 text-center font-bold">32</td>
                  </tr>
                  <tr className="border-t border-white/10 bg-accent/20">
                    <td className="px-4 py-3 text-accent font-bold">3.</td>
                    <td className="px-4 py-3 font-bold text-accent">FK Frýdek-Místek</td>
                    <td className="px-4 py-3 text-center">15</td>
                    <td className="px-4 py-3 text-center font-bold">30</td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/60">4.</td>
                    <td className="px-4 py-3 font-medium">MFK Vítkovice</td>
                    <td className="px-4 py-3 text-center">15</td>
                    <td className="px-4 py-3 text-center font-bold">28</td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/60">5.</td>
                    <td className="px-4 py-3 font-medium">SK Sigma Olomouc B</td>
                    <td className="px-4 py-3 text-center">15</td>
                    <td className="px-4 py-3 text-center font-bold">25</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
