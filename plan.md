# Plan: Fix CI and Add Tests

## Problem Analysis

**All 3 failing CI pipelines (API, Nextjs, Presentation) fail for the same reason:**

`nextjs/package.json` has `"lightningcss-linux-arm64-gnu": "^1.31.1"` as a direct dependency. This ARM64-only native binary gets locked into `package-lock.json`. When CI runs `npm ci` on x64 Linux (GitHub Actions `ubuntu-latest`), it fails with `EBADPLATFORM`.

All Dockerfiles (including presentation and api) run `npm ci` at the workspace root, which tries to install all workspace dependencies — including this ARM64 package.

**Additionally:** Presentation CI has a `lint` job that runs `npm ci` at root level before linting — same failure.

**No tests exist** in the project. We need to add test infrastructure for the presentation app and cover the new match-result feature.

## Step 1: Fix CI — Remove platform-specific dependency

**File:** `nextjs/package.json`
- Remove `"lightningcss-linux-arm64-gnu": "^1.31.1"` from dependencies
- This package is auto-resolved by `lightningcss` via optional dependencies — it should never be a direct dependency

**File:** `package-lock.json`
- Regenerate with `npm install` after removing the dependency

## Step 2: Set up Vitest in the presentation app

**Why Vitest:** It's the standard for modern Next.js/TypeScript projects, runs fast, has built-in ESM support, and doesn't need complex config.

**Files to create/modify:**

### `presentation/package.json`
- Add devDependencies: `vitest`
- Add script: `"test": "vitest run"`, `"test:watch": "vitest"`

### `presentation/vitest.config.ts` (new)
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Step 3: Write tests for the match-result feature

### `presentation/src/lib/strapi/mappers/__tests__/match-result.test.ts` (new)

Test `mapMatchResult()`:
- Maps all fields correctly from raw Strapi data
- Derives `status: 'finished'` when both scores are non-null
- Derives `status: 'upcoming'` when scores are null
- Formats Czech dates correctly (day name, day number, month)
- Handles null `matchTime`, `venue`, `competitionName` with empty string fallbacks
- Handles null `round`

### `presentation/src/lib/strapi/__tests__/data.test.ts` (new)

Test `getMatchesByCategory()`:
- Mock the `StrapiClient.findMany` (mock the `./client` module)
- Returns mapped matches when Strapi returns data
- Returns empty array when Strapi returns empty data
- Passes correct content type, filters, sort, and pagination to the client

### `presentation/src/lib/strapi/mappers/__tests__/category.test.ts` (new)

Test `mapCategory()` and `mapCategories()`:
- Maps raw category fields correctly
- `mapCategories` handles null/undefined input
- Default `sortOrder` to 0 when null

### `presentation/src/lib/strapi/mappers/__tests__/shared.test.ts` (new)

Test `transformImageUrl()`, `mapMedia()`, `mapMediaArray()`:
- Prepends uploads URL for `/uploads/` paths
- Passes through non-upload URLs
- Returns null for null/undefined media
- `mapMediaArray` filters out null entries

## Step 4: Add lint + test to Presentation CI

**File:** `.github/workflows/presentation.yml`
- Add `npm run test` step after lint in the `lint` job (rename job to `lint-and-test` or keep `lint` — just add a step)

## Step 5: Verify everything passes

1. Run `npm run lint` in presentation — must pass
2. Run `npm run test` in presentation — must pass
3. Simulate CI: remove `node_modules`, run `npm ci`, verify no platform errors
4. Docker build should succeed

## Files Changed Summary

| File | Action |
|------|--------|
| `nextjs/package.json` | Remove `lightningcss-linux-arm64-gnu` |
| `package-lock.json` | Regenerate |
| `presentation/package.json` | Add vitest devDep + test scripts |
| `presentation/vitest.config.ts` | New — vitest config |
| `presentation/src/lib/strapi/mappers/__tests__/match-result.test.ts` | New — mapper tests |
| `presentation/src/lib/strapi/__tests__/data.test.ts` | New — data fetcher tests |
| `presentation/src/lib/strapi/mappers/__tests__/category.test.ts` | New — category mapper tests |
| `presentation/src/lib/strapi/mappers/__tests__/shared.test.ts` | New — shared mapper tests |
| `.github/workflows/presentation.yml` | Add test step |
