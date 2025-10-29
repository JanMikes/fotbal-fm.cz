import ActualityCard from '../ui/ActualityCard';
import type { Actuality } from '@/types';

interface ActualitiesSectionProps {
  actualities: Actuality[];
}

export default function ActualitiesSection({
  actualities,
}: ActualitiesSectionProps) {
  if (actualities.length === 0) {
    return null;
  }

  // Show only the 3 most recent actualities
  const recentActualities = actualities.slice(0, 3);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-10 text-center">
          Aktuality
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recentActualities.map((actuality) => (
            <ActualityCard key={actuality.id} actuality={actuality} />
          ))}
        </div>
      </div>
    </section>
  );
}
