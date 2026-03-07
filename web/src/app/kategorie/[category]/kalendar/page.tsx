import { redirect } from 'next/navigation';

interface CalendarPageProps {
  params: Promise<{ category: string }>;
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { category: categorySlug } = await params;
  redirect(`/kategorie/${categorySlug}/zapasy`);
}
