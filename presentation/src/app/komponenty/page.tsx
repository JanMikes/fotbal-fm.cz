import KomponentyContent from './KomponentyContent';
import SidebarShowcase from './SidebarShowcase';

export const metadata = {
  title: 'Komponenty | FK Frýdek-Místek',
  description: 'Showcase all dynamic zone components',
};

export default function KomponentyPage() {
  return (
    <main className="bg-surface-light mt-28 lg:mt-32">
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-2">Komponenty</h1>
        <p className="text-primary/60 mb-12">Showcase all dynamic zone components with football mock data.</p>

        {/* Sidebar layout demo */}
        <SidebarShowcase />

        {/* All components individually */}
        <div className="mt-16 pt-8 border-t-2 border-primary/10">
          <h2 className="text-2xl font-bold text-primary mb-8">Jednotlivé komponenty</h2>
          <KomponentyContent />
        </div>
      </div>
    </main>
  );
}
