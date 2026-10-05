import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// U1 (tag-map drift): every content type a query filters on or populates must be covered by the
// query's declared cache tags — a missing tag means a page stays stale after a write of that type
// until the 5-min soft TTL. Over-declared tags fail too (needless refreshes). The walk uses the
// real Strapi schemas (strapi/src/api/**/schema.json, strapi/src/components/**). It also derives
// the endpoints the readiness latch must probe for token problems (P0-V11).

vi.mock('@/lib/config', () => ({
  config: { strapi: { url: 'http://strapi:1337', apiToken: '' }, publicUploadsUrl: 'http://u', internalUploadsUrl: 'http://u' },
}));

const { QUERIES } = await import('@/lib/strapi/data');
const { STRAPI_READ_ENDPOINTS } = await import('@/lib/strapi/auth-probe');
const { default: TYPE_TAGS } = await import('../../../../../packages/cache/src/type-tags.json');

type Attribute = {
  type: string;
  target?: string;
  component?: string;
  components?: string[];
};
type Schema = { uid: string; kind?: string; singularName?: string; pluralName?: string; attributes: Record<string, Attribute> };

const STRAPI_SRC = path.resolve(__dirname, '../../../../../strapi/src');
const MEDIA = 'plugin::upload.file';

function loadSchemas(): Map<string, Schema> {
  const schemas = new Map<string, Schema>();
  for (const dir of readdirSync(path.join(STRAPI_SRC, 'api'))) {
    const ctDir = path.join(STRAPI_SRC, 'api', dir, 'content-types');
    if (!existsSync(ctDir)) continue;
    for (const ct of readdirSync(ctDir)) {
      const json = JSON.parse(readFileSync(path.join(ctDir, ct, 'schema.json'), 'utf8'));
      const uid = `api::${dir}.${json.info.singularName}`;
      schemas.set(uid, { uid, kind: json.kind, singularName: json.info.singularName, pluralName: json.info.pluralName, attributes: json.attributes });
    }
  }
  for (const category of readdirSync(path.join(STRAPI_SRC, 'components'))) {
    for (const file of readdirSync(path.join(STRAPI_SRC, 'components', category))) {
      const json = JSON.parse(readFileSync(path.join(STRAPI_SRC, 'components', category, file), 'utf8'));
      const uid = `${category}.${file.replace(/\.json$/, '')}`;
      schemas.set(uid, { uid, attributes: json.attributes });
    }
  }
  return schemas;
}

const SCHEMAS = loadSchemas();

function schemaFor(uid: string): Schema {
  const schema = SCHEMAS.get(uid);
  if (!schema) throw new Error(`no schema for ${uid}`);
  return schema;
}

/** Content types (and media) a request reaches through its filters and populate. */
function reachable(rootUid: string, options: { filters?: unknown; populate?: unknown }): Set<string> {
  const found = new Set<string>([rootUid]);

  const walkFilters = (schema: Schema, filters: unknown): void => {
    if (Array.isArray(filters)) return filters.forEach((f) => walkFilters(schema, f));
    if (typeof filters !== 'object' || filters === null) return;
    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith('$')) {
        walkFilters(schema, value);
        continue;
      }
      const attr = schema.attributes[key];
      if (!attr) continue; // id, documentId, timestamps
      if (attr.type === 'relation' && attr.target) {
        found.add(attr.target);
        if (attr.target !== MEDIA && !attr.target.startsWith('plugin::')) walkFilters(schemaFor(attr.target), value);
      } else if (attr.type === 'media') {
        found.add(MEDIA);
      } else if (attr.type === 'component' && attr.component) {
        walkFilters(schemaFor(attr.component), value);
      }
    }
  };

  /** `*` / `true`: one level — relations and media are populated with their own fields only. */
  const firstLevel = (schema: Schema): void => {
    for (const attr of Object.values(schema.attributes)) {
      if (attr.type === 'relation' && attr.target) found.add(attr.target);
      else if (attr.type === 'media') found.add(MEDIA);
      else if (attr.type === 'component' && attr.component) firstLevel(schemaFor(attr.component));
      else if (attr.type === 'dynamiczone') attr.components?.forEach((c) => firstLevel(schemaFor(c)));
    }
  };

  const walkPopulate = (schema: Schema, populate: unknown): void => {
    if (populate === '*' || populate === true) return firstLevel(schema);
    if (typeof populate !== 'object' || populate === null) return;
    for (const [key, value] of Object.entries(populate)) {
      const attr = schema.attributes[key];
      if (!attr) throw new Error(`${schema.uid} has no attribute "${key}" (populate)`);
      const spec = (typeof value === 'object' && value !== null ? value : {}) as { populate?: unknown; filters?: unknown; on?: Record<string, unknown> };
      if (attr.type === 'relation' && attr.target) {
        found.add(attr.target);
        if (attr.target.startsWith('plugin::')) continue;
        if (spec.populate) walkPopulate(schemaFor(attr.target), spec.populate);
        if (spec.filters) walkFilters(schemaFor(attr.target), spec.filters);
      } else if (attr.type === 'media') {
        found.add(MEDIA);
      } else if (attr.type === 'component' && attr.component) {
        // `true` loads the component's own fields; its relations/media only with `*` or a nested populate
        if (value === '*') firstLevel(schemaFor(attr.component));
        if (spec.populate) walkPopulate(schemaFor(attr.component), spec.populate);
      } else if (attr.type === 'dynamiczone') {
        for (const [component, fragment] of Object.entries(spec.on ?? {})) {
          const f = fragment as { populate?: unknown };
          if (f.populate) walkPopulate(schemaFor(component), f.populate);
        }
      }
    }
  };
  const root = schemaFor(rootUid);
  walkFilters(root, options.filters);
  walkPopulate(root, options.populate);
  return found;
}

function uidForEndpoint(contentType: string): string {
  for (const schema of SCHEMAS.values()) {
    if (schema.pluralName === contentType || (schema.kind === 'singleType' && schema.singularName === contentType)) return schema.uid;
  }
  throw new Error(`no content type for /api/${contentType}`);
}

function endpointFor(uid: string): string {
  if (uid === MEDIA) return 'upload/files';
  const schema = schemaFor(uid);
  return schema.kind === 'singleType' ? schema.singularName! : schema.pluralName!;
}

function tagsFor(uid: string): string[] {
  if (uid === MEDIA) return ['media'];
  if (!uid.startsWith('api::')) throw new Error(`a query reaches ${uid}: writes to it bump no cache tag`);
  const name = uid.slice(5).split('.')[0];
  if (TYPE_TAGS.ignored.includes(name)) throw new Error(`a query reaches ${uid}, which the tag map ignores`);
  const tags = (TYPE_TAGS.typeTags as Record<string, string[]>)[name];
  if (!tags) throw new Error(`${uid} is missing from type-tags.json`);
  return tags;
}

/** One representative call per query; every query in QUERIES must be listed (no silent gaps). */
const SAMPLES: { [K in keyof typeof QUERIES]: Parameters<(typeof QUERIES)[K]> } = {
  getCategories: [],
  getCategoryBySlug: ['muzi-a'],
  getCategorySlugIndex: [],
  getCategoryGroups: [],
  getNewsArticlesByCategory: ['muzi-a', 1, 6, ['reporty', 'rozhovory']],
  getAllNewsArticles: [1, 12, ['reporty', 'rozhovory'], ['muzi-a', 'dorost']],
  getNewsArticleTypes: [],
  getNewsArticleBySlug: ['clanek'],
  getUpcomingMatches: ['muzi-a', 3, '2026-10-06'],
  getFinishedMatches: ['muzi-a', 3],
  getAllMatchesByCategory: ['muzi-a'],
  getClubMatches: [{ categorySlug: 'muzi-a', season: 2026, homeAway: 'home', page: 2 }],
  getAvailableSeasons: [],
  getPlayersByCategory: ['muzi-a'],
  getNavigation: [],
  getFooter: [],
  getNavigationPages: [],
  getPageBySlug: ['o-klubu'],
  getPageSlugIndex: [],
  getStandingsByCategory: ['muzi-a'],
  getCategoryWithHeroBySlug: ['muzi-a'],
  getUpcomingMatch: ['muzi-a', '2026-10-06'],
  getLastResult: ['muzi-a'],
  getPartners: [],
  getPartnerBySlug: ['partner'],
  getPlayerHighlightsByCategory: ['muzi-a'],
  getDeepLinkByCode: ['7K3M9PQ2'],
};

const ENTRIES = Object.entries(SAMPLES).map(([name, args]) => {
  const build = QUERIES[name as keyof typeof QUERIES] as (...a: unknown[]) => import('@/lib/strapi/data').Query;
  return { name, query: build(...(args as unknown[])) };
});

describe('U1: declared cache tags match what each query reaches', () => {
  it('every query has a sample', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(QUERIES).sort());
  });

  it.each(ENTRIES)('$name', ({ query }) => {
    const reached = reachable(uidForEndpoint(query.contentType), query.options);
    const expected = new Set([...reached].flatMap(tagsFor));
    expect(new Set(query.tags)).toEqual(expected);
  });

  it('the readiness latch probes exactly the endpoints the queries reach (P0-V11)', () => {
    const endpoints = new Set<string>();
    for (const { query } of ENTRIES) {
      for (const uid of reachable(uidForEndpoint(query.contentType), query.options)) endpoints.add(endpointFor(uid));
    }
    expect(new Set(STRAPI_READ_ENDPOINTS)).toEqual(endpoints);
  });
});

describe('U1 walker sanity', () => {
  it('finds a relation reached only through a filter', () => {
    expect(reachable('api::match.match', { filters: { homeTeam: { name: { $containsi: 'x' } } } })).toContain('api::team.team');
  });

  it('finds relations inside dynamic-zone fragments and nested components', () => {
    const found = reachable('api::partner.partner', {
      populate: { content: { on: { 'components.form': { populate: { form: { populate: { inputGroups: { populate: { inputs: { populate: '*' } } } } } } } } } },
    });
    expect(found).toContain('api::form.form');
  });

  it('`*` on a component reaches its relations and media; `true` does not', () => {
    expect(reachable('api::navigation.navigation', { populate: { link: '*' } })).toContain('api::page.page');
    expect(reachable('api::navigation.navigation', { populate: { link: true } })).not.toContain('api::page.page');
  });

  it('throws on a populate key the schema does not have (a typo would otherwise hide a type)', () => {
    expect(() => reachable('api::page.page', { populate: { contnet: '*' } })).toThrow(/no attribute "contnet"/);
  });
});
