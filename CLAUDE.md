# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing multiple applications:
- **backoffice/**: Next.js 16 backoffice application for coaches/management (TypeScript, React 19, Tailwind CSS 4)
- **web/**: Next.js 16 public-facing website (TypeScript, React 19, Tailwind CSS 4)
- **api/**: REST API service (Hono, TypeScript)
- **strapi/**: Strapi 5 CMS backend (TypeScript, PostgreSQL)

The applications are orchestrated with Docker Compose and share uploaded media files via volume mounting.

## Architecture

### Monorepo Structure
```
/
├── backoffice/      # Backoffice application (coaches/management)
├── web/             # Public-facing website
├── api/             # REST API service
├── packages/        # Shared packages
├── strapi/          # CMS backend
└── compose.yaml     # Docker orchestration
```

### Docker Services
- **postgres**: PostgreSQL 17 database for Strapi
- **strapi**: Strapi CMS (port 1337)
- **backoffice**: Backoffice app (port 3000)
- **web**: Public website (port 3001)
- **api**: REST API (port 4000)
- **adminer**: Database management UI (port 8000)

### Shared Resources
The backoffice app has read access to Strapi uploads via shared volume:
- `strapi/public/uploads` → `backoffice/public/uploads`

This allows the backoffice app to serve media files uploaded through Strapi without API calls.

## Development Commands

**IMPORTANT**: All development commands must be run inside Docker containers. Never run `npm` or other commands directly on the host machine.

### Running the Full Stack
```bash
# Start all services (from root directory)
docker compose up

# Start in detached mode (background)
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart backoffice
docker compose restart web
docker compose restart strapi

# Access points:
# - Backoffice: http://localhost:3000
# - Web: http://localhost:3001
# - Strapi Admin: http://localhost:1337/admin
# - Adminer: http://localhost:8000
```

### Backoffice Development
```bash
# Run commands inside the backoffice container
docker compose exec backoffice <command>

# Install dependencies
docker compose exec backoffice npm install

# Run linting
docker compose exec backoffice npm run lint

# Build for production
docker compose exec backoffice npm run build

# Run any other npm script
docker compose exec backoffice npm run <script-name>

# Open interactive shell in container
docker compose exec backoffice bash
```

### Web Development
```bash
# Run commands inside the web container
docker compose exec web <command>

# Install dependencies
docker compose exec web npm install

# Run linting
docker compose exec web npm run lint

# Build for production
docker compose exec web npm run build

# Open interactive shell in container
docker compose exec web bash
```

### Strapi Development
```bash
# Run commands inside the strapi container
docker compose exec strapi <command>

# Install dependencies
docker compose exec strapi npm install

# Build admin panel
docker compose exec strapi npm run build

# Access Strapi CLI
docker compose exec strapi npm run strapi -- <command>

# Generate content type
docker compose exec strapi npm run strapi -- generate

# Open Strapi console
docker compose exec strapi npm run console

# Upgrade Strapi
docker compose exec strapi npm run upgrade        # Perform upgrade
docker compose exec strapi npm run upgrade:dry    # Preview upgrade changes

# Open interactive shell in container
docker compose exec strapi bash
```

### Container Management
```bash
# View logs from all services
docker compose logs

# View logs from specific service
docker compose logs backoffice
docker compose logs web
docker compose logs strapi

# Follow logs in real-time
docker compose logs -f backoffice

# Check service status
docker compose ps

# Rebuild containers after dependency changes
docker compose up --build
```

### Data Sync - Full Setup Guide

All sync scripts require `FACR_EMAIL` and `FACR_PASSWORD` env vars (set in `compose.override.yaml`).

**Seasons:** FAČR syncs scrape the *current* season by default (the pre-selected "Ročník" in FAČR IS; season 2026 = 2026/2027). Pass `--season 2025` to any FAČR sync/scrape script to target a specific season. Season is stored as the start year on tournaments, matches and standings. Standings sync only deletes stale rows within the competitions+seasons it scraped, so past-season tables are preserved.

**Club subjects:** FAČR syncs scrape *all* club subjects listed in `FACR_CLUBS` (`api/src/lib/facr.ts`) and merge the results — currently FK Frýdek-Místek z.s. (8020091, youth) and FK Frýdek-Místek 1921 a.s. (8020601, Muži A/B since 2026/27). To add a subject, look up its internal id via `https://is.fotbal.cz/public/services/public-client.aspx?type=oddil&typ=1&query=<club number>` and append it to `FACR_CLUBS`.

**Step 1: Sync tournaments (competitions) from FAČR**
```bash
docker compose exec api npx tsx src/cli/sync-tournaments.ts
```

**Step 2: Manual - pair category codes in Strapi admin**
Go to Strapi admin → Category Codes. For each FAČR competition code (e.g. `A1A`, `E1A`), create an entry linking it to the appropriate category. This mapping determines which competitions/matches/standings appear under which category on the website. Only needs to be done once per new competition code.

**Step 3: Sync matches from FAČR**
```bash
docker compose exec api npx tsx src/cli/sync-matches.ts
```

**Step 4: Sync standings from FAČR**
```bash
docker compose exec api npx tsx src/cli/sync-standings.ts
```

**Step 5: Sync players from FAČR**
```bash
docker compose exec api npx tsx src/cli/sync-players.ts
```

**Step 6: Sync players from SportBM**
```bash
docker compose exec api npx tsx src/cli/sync-sportbm-players.ts
```
Requires `sportbmCategoryId` to be set on categories in Strapi admin.

**Production: everything runs live on the lily host cron** (`~/www/lily.srv/apps/fotbal-fm/cron.d/fotbal-fm` → `facr-sync.sh`, Prague time):
- every 15 min 08–23: matches + standings
- nightly 05:10: tournaments, matches, standings, players, sportbm-players

Each run is wrapped in `sentry-cli monitors run` (Sentry Crons, project `fotbal-fm-nextjs`, monitors `facr-sync-live` / `facr-sync-nightly`) for missed/failed runs, plus lily's `LilyCronJobFailed`. Log: `/var/log/lily/fotbal-fm-cron.log`. **Deploys never sync data** — the committed `api/data/` snapshot is not used in production. To sync by hand on lily: `/srv/fotbal-fm/facr-sync.sh matches standings` (names = `src/cli/sync-<name>.ts`; shares the cron's lock).

`sync-sportbm-players.ts --dry-run` prints every change it would make (old → new values) without writing anything.

**Offline pattern (local development only):** `scrape-facr.ts` / `scrape-sportbm.ts` save JSON + photos to `api/data/`, and every sync accepts `--from-file`. Never run `--from-file` against production: it re-applies a stale snapshot (that is what the old deploy-time sync did on every api deploy).

**Regular sync order:** Steps 1, 3, 4, 5, 6 can be re-run anytime. Step 2 only when new competition codes appear (logged as "missing category mapping").

### Web Cache

The web app caches all Strapi data in Redis (24h TTL, key prefix `fotbalfm:`). Invalidation is two-fold:
1. The Strapi webhook "Clear cache" → `http://web:3000/api/cache/clear` (header `X-Strapi-Webhook-Signature: $STRAPI_WEBHOOK_SECRET`) fires on every entry create/update/delete, so content edited in Strapi admin or backoffice shows on the web immediately. Note: Strapi loads webhook config at startup — restart strapi after changing the webhook directly in the DB.
2. Every sync script additionally flushes the whole cache once at the end of its run (`flushWebCache()` in `api/src/lib/cache-flush.ts`; requires `REDIS_URL` on the api service, no-op without it) — a guarantee of a consistent final state after bulk syncs. The FAČR syncs (tournaments, matches, standings, players) and the SportBM players sync only PUT entries whose fields actually differ (`changedFields()` in `api/src/lib/sync-diff.ts` — Strapi bumps `updatedAt` and fires the webhook even on an identical write) and skip the flush when the run changed nothing (`flushWebCacheIfChanged()`).

### Audience Categories & Deep Links

Full design + API contract: `docs/audience-categories-deep-links.md`. Mobile-side instructions (Czech, handed over as PDF): `docs/mobile-deep-links-instrukce.md`.

- Strapi: `audience-category`, `deep-link` (code/url generated by its lifecycle, base URL from `DEEP_LINK_BASE_URL`), `deep-link-claim`; user extension gets `audienceCategories`. Admins create links in Strapi → copy `url`.
- API (`/api/v1`): `GET /audience-categories`, `GET|PUT /me/audience-categories`, `GET /deep-links/{code}`, `POST /deep-links/{code}/claim`, `POST /deep-links` (invite a friend), optional `deepLinkCode` on login/register. All writes use the service token; JWT only identifies the caller.
- Web: landing page `/a/[code]`, association files under `/.well-known` (identifiers in `web/src/lib/config.ts` → `mobileApp`, env `MOBILE_*`), webhook `/api/cache/clear` skips full flushes for the three new models.
- Security shipped with it: `strapi/src/extensions/users-permissions/strapi-server.ts` (own-profile-only user routes for JWT callers) and `enforceUserPermissionPolicy()` in `strapi/src/index.ts` (removes Public `user.create`, Authenticated `user.count` on every boot).
- Dev gotcha: the api/web containers' file watchers do not always see edits on the bind mount — `docker compose restart api` (or `web`) after editing.

## Configuration Notes

### Strapi Database
Configured for PostgreSQL via environment variables in `compose.yaml`. The database configuration in `strapi/config/database.ts` supports:
- PostgreSQL (used in Docker)
- MySQL
- SQLite (default for local development)

Database selection is controlled by the `DATABASE_CLIENT` environment variable.

### Backoffice Configuration
- Uses App Router (Next.js 16+)
- TypeScript with path alias: `@/*` maps to root directory
- Tailwind CSS 4 with PostCSS
- React 19 with modern JSX transform

### Environment Variables (Docker)
Security tokens in `compose.yaml` are set to defaults. **These must be changed for production deployments**:
- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`

## Strapi Structure

### Content Types
Content types are defined in `strapi/src/api/`. Currently empty (fresh installation).

When creating new content types:
1. Use Strapi admin UI or CLI: `npm run strapi -- generate`
2. Content type definitions appear in `src/api/<content-type>/`
3. Each content type includes:
   - `content-types/`: Schema definitions
   - `controllers/`: Request handlers
   - `routes/`: API endpoints
   - `services/`: Business logic

### Strapi Configuration Files
- `config/admin.ts`: Admin panel settings
- `config/api.ts`: API configuration
- `config/database.ts`: Database connection
- `config/middlewares.ts`: Middleware stack
- `config/plugins.ts`: Plugin configuration
- `config/server.ts`: Server settings

## Tech Stack Versions

- Node.js: 24.x (via Docker)
- Next.js: 16.0.3
- React: 19.2.0
- Strapi: 5.38.0
- PostgreSQL: 17.0
- TypeScript: 5.x
- Tailwind CSS: 4.x
