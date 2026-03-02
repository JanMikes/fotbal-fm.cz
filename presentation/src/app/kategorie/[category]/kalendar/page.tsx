import { redirect } from 'next/navigation';
import { getCategories } from '@/lib/strapi/data';

interface CalendarPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { category: categorySlug } = await params;
  redirect(`/kategorie/${categorySlug}/zapasy`);
}
