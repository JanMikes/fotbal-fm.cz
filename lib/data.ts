import type {
  Category,
  MatchesData,
  Player,
  Actuality,
  ResultsTable,
  Partner,
  CategoryData,
} from '@/types';

// Base URL for Strapi API (to be configured later)
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || '';
const USE_STRAPI = process.env.NEXT_PUBLIC_USE_STRAPI === 'true';

/**
 * Fetch matches data for a specific category
 * Currently uses local JSON files, ready for Strapi migration
 */
export async function getMatches(category: Category): Promise<MatchesData> {
  if (USE_STRAPI && STRAPI_URL) {
    // TODO: Fetch from Strapi
    const response = await fetch(`${STRAPI_URL}/api/matches?category=${category}`);
    return response.json();
  }

  // Use local JSON files
  const data = await import(`@/data/${category}/matches.json`);
  return data.default;
}

/**
 * Fetch players data for a specific category
 */
export async function getPlayers(category: Category): Promise<Player[]> {
  if (USE_STRAPI && STRAPI_URL) {
    // TODO: Fetch from Strapi
    const response = await fetch(`${STRAPI_URL}/api/players?category=${category}`);
    return response.json();
  }

  // Use local JSON files
  const data = await import(`@/data/${category}/players.json`);
  return data.default;
}

/**
 * Fetch actualities (news) for a specific category
 */
export async function getActualities(category: Category): Promise<Actuality[]> {
  if (USE_STRAPI && STRAPI_URL) {
    // TODO: Fetch from Strapi
    const response = await fetch(`${STRAPI_URL}/api/actualities?category=${category}`);
    return response.json();
  }

  // Use local JSON files
  const data = await import(`@/data/${category}/actualities.json`);
  return data.default;
}

/**
 * Fetch a single actuality by ID
 */
export async function getActuality(
  category: Category,
  id: string
): Promise<Actuality | null> {
  const actualities = await getActualities(category);
  return actualities.find((actuality) => actuality.id === id) || null;
}

/**
 * Fetch results table for a specific category
 */
export async function getResultsTable(category: Category): Promise<ResultsTable> {
  if (USE_STRAPI && STRAPI_URL) {
    // TODO: Fetch from Strapi
    const response = await fetch(`${STRAPI_URL}/api/table?category=${category}`);
    return response.json();
  }

  // Use local JSON files
  const data = await import(`@/data/${category}/table.json`);
  return data.default;
}

/**
 * Fetch partners list
 */
export async function getPartners(): Promise<Partner[]> {
  if (USE_STRAPI && STRAPI_URL) {
    // TODO: Fetch from Strapi
    const response = await fetch(`${STRAPI_URL}/api/partners`);
    return response.json();
  }

  // Use local JSON file (shared across all categories)
  const data = await import('@/data/partners.json');
  return data.default;
}

/**
 * Fetch all data for a specific category
 * Useful for category pages
 */
export async function getCategoryData(category: Category): Promise<CategoryData> {
  const [matches, players, actualities, table, partners] = await Promise.all([
    getMatches(category),
    getPlayers(category),
    getActualities(category),
    getResultsTable(category),
    getPartners(),
  ]);

  return {
    category,
    matches,
    players,
    actualities,
    table,
    partners,
  };
}

/**
 * Get category display name in Czech
 */
export function getCategoryName(category: Category): string {
  const names: Record<Category, string> = {
    muzi: 'Muži',
    dorostenci: 'Dorostenci',
    zaci: 'Žáci',
    pripravka: 'Přípravka',
  };
  return names[category];
}

/**
 * Get all categories
 */
export function getCategories(): Category[] {
  return ['muzi', 'dorostenci', 'zaci', 'pripravka'];
}
