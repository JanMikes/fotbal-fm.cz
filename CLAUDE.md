# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing two main applications:
- **nextjs/**: Next.js 16 frontend application (TypeScript, React 19, Tailwind CSS 4)
- **strapi/**: Strapi 5 CMS backend (TypeScript, PostgreSQL)

The applications are orchestrated with Docker Compose and share uploaded media files via volume mounting.

## Architecture

### Monorepo Structure
```
/
├── nextjs/          # Frontend application
├── strapi/          # CMS backend
└── compose.yaml     # Docker orchestration
```

### Docker Services
- **postgres**: PostgreSQL 17 database for Strapi
- **strapi**: Strapi CMS (port 1337)
- **nextjs**: Next.js frontend (port 3000)
- **adminer**: Database management UI (port 8000)

### Shared Resources
The Next.js app has read access to Strapi uploads via shared volume:
- `strapi/public/uploads` → `nextjs/public/uploads`

This allows Next.js to serve media files uploaded through Strapi without API calls.

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
docker compose restart nextjs
docker compose restart strapi

# Access points:
# - Next.js: http://localhost:3000
# - Strapi Admin: http://localhost:1337/admin
# - Adminer: http://localhost:8000
```

### Next.js Development
```bash
# Run commands inside the nextjs container
docker compose exec nextjs <command>

# Install dependencies
docker compose exec nextjs npm install

# Run linting
docker compose exec nextjs npm run lint

# Build for production
docker compose exec nextjs npm run build

# Run any other npm script
docker compose exec nextjs npm run <script-name>

# Open interactive shell in container
docker compose exec nextjs bash
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
docker compose logs nextjs
docker compose logs strapi

# Follow logs in real-time
docker compose logs -f nextjs

# Check service status
docker compose ps

# Rebuild containers after dependency changes
docker compose up --build
```

### Data Sync - Full Setup Guide

All sync scripts require `FACR_EMAIL` and `FACR_PASSWORD` env vars (set in `compose.override.yaml`).

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

**Offline scrape + sync pattern (for production where external APIs are unreachable):**
```bash
# Scrape locally (where SportBM/FAČR is reachable), then commit data to repo
docker compose exec api npx tsx src/cli/scrape-facr.ts
docker compose exec api npx tsx src/cli/scrape-sportbm.ts

# Sync from file on production (uses committed JSON + photos)
docker compose exec api npx tsx src/cli/sync-sportbm-players.ts --from-file
```

**For cron (non-interactive, no TTY) - use `-T` flag:**
```bash
docker compose exec -T api npx tsx src/cli/sync-tournaments.ts
docker compose exec -T api npx tsx src/cli/sync-matches.ts
docker compose exec -T api npx tsx src/cli/sync-standings.ts
docker compose exec -T api npx tsx src/cli/sync-players.ts
docker compose exec -T api npx tsx src/cli/sync-sportbm-players.ts --from-file
```

**Regular sync order:** Steps 1, 3, 4, 5, 6 can be re-run anytime. Step 2 only when new competition codes appear (logged as "missing category mapping").

## Configuration Notes

### Strapi Database
Configured for PostgreSQL via environment variables in `compose.yaml`. The database configuration in `strapi/config/database.ts` supports:
- PostgreSQL (used in Docker)
- MySQL
- SQLite (default for local development)

Database selection is controlled by the `DATABASE_CLIENT` environment variable.

### Next.js Configuration
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
