import type { Partner } from '@/types';

interface PartnersSectionProps {
  partners: Partner[];
}

export default function PartnersSection({ partners }: PartnersSectionProps) {
  if (partners.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-10 text-center">
          Naši partneři
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow flex items-center justify-center"
            >
              {partner.website ? (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-20 flex items-center justify-center grayscale hover:grayscale-0 transition-all"
                >
                  {partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-600 font-semibold px-2">
                      {partner.name}
                    </div>
                  )}
                </a>
              ) : (
                <div className="w-full h-20 flex items-center justify-center grayscale">
                  {partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-600 font-semibold px-2">
                      {partner.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 mt-10">
          Děkujeme našim partnerům za podporu!
        </p>
      </div>
    </section>
  );
}
