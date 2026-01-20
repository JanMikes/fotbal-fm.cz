import { Header, Footer } from '@/components/layout';
import { Hero, Matches, Statistics, News, Team } from '@/components/sections';

export default function Home() {
  return (
    <>
      <Header />
      <main className="bg-surface-light">
        <Hero />
        <Matches />
        <Statistics />
        <News />
        <Team />
      </main>
      <Footer />
    </>
  );
}
