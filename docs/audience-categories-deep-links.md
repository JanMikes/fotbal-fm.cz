# Audience categories & deep links

Audience categories are named groups assigned to app users (N:M). Deep links are shareable URLs
`https://fotbal-fm.cz/a/<code>` that put a set of audience categories on whoever registers or signs
in through them. Both are managed in Strapi and exposed through the Hono API for the mobile app
(`Wantoo-cz/fotbal-fm-mobile-app`, .NET MAUI). Push-notification targeting by audience category
comes later and builds on the same data.

Mobile-side requirements are in `docs/mobile-deep-links-instrukce.md` (Czech, handed over as PDF).

## Data model (Strapi)

| Content type | Fields | Notes |
|---|---|---|
| `audience-category` | `name` (unique), `slug` (uid), `description`, `sortOrder`, `selectable` (bool, default true), `users` (N:M), `deepLinks` (N:M) | `slug` is the stable id used by the API and later by push targeting. `selectable = false` = only a deep link or an admin can add it; users can still remove it. |
| `deep-link` | `name`, `code` (unique, generated), `url` (derived), `audienceCategories` (N:M), `active` (default true), `expiresAt`, `claimsCount`, `createdByUser` (→ user, set for app-created invites), `claims` (1:N) | `code` and `url` are filled by `strapi/src/api/deep-link/content-types/deep-link/lifecycles.ts` on save. Leave `code` empty to get a generated one, or type a custom one (A–Z, 0–9, 4–16 chars; normalized to uppercase). |
| `deep-link-claim` | `label`, `deepLink` (→ deep-link), `user` (→ user), `source` (register / login / claim), `platform` (ios / android / web / unknown) | One row per user and link, written by the API only. Shows "who came through which link" on the link and on the user. |
| `user` (users-permissions extension) | `audienceCategories` (N:M), `deepLinkClaims` (1:N), `createdDeepLinks` (1:N) | Editable in the admin user form. |

Codes: 8 characters from Crockford base32 (`0-9 A-Z` without `I L O U`) so they can be read aloud
and typed; 32^8 ≈ 1.1e12 combinations behind a rate limit. Lookups are case-insensitive, ignore
spaces and dashes, and retry a typed `O`/`I`/`L` as `0`/`1`/`1`.

`DEEP_LINK_BASE_URL` (Strapi env, default `https://fotbal-fm.cz/a`) is the base of every generated
`url`. Dev compose points it at the local web app.

## API (Hono, `/api/v1`)

All writes go through the service API token; the caller's JWT is only used to resolve *who* they
are (`/users/me`). A user can therefore never touch another user's categories.

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /audience-categories` | none | Selectable categories for the settings picker, sorted by `sortOrder`. |
| `GET /me/audience-categories` | Bearer JWT | The caller's categories, including non-selectable ones (each carries `selectable`). |
| `PUT /me/audience-categories` | Bearer JWT | Body `{ "audienceCategories": ["slug", …] }` — the full new list. Any selectable slug may be added; a non-selectable one may only be kept if already owned. `400` on unknown / not allowed slug. |
| `GET /deep-links/{code}` | none | Resolves a link: `name`, `url`, `audienceCategories`, `expiresAt`. `404` with `reason` = `not_found` / `inactive` / `expired`. |
| `POST /deep-links/{code}/claim` | Bearer JWT | Puts the link's categories on the caller. Idempotent: a second claim of the same link by the same user changes nothing (`alreadyClaimed: true`) — it does not re-add a category the user has since removed. |
| `POST /deep-links` | Bearer JWT | "Invite a friend": creates a link owned by the caller. Body optional: `{ "audienceCategories": ["slug", …], "name": "…" }`; omitted = the caller's own selectable categories. Only selectable categories can be shared. An identical active link by the same user is returned instead of a new code. |
| `POST /auth/register`, `POST /auth/login` | none | New optional body field `deepLinkCode` (`null` / empty = none). On success the code is claimed server-side; the response gains `user.audienceCategories` and `deepLink` (`{ code, claimed, alreadyClaimed, reason?, addedAudienceCategories, audienceCategories }`, `reason` ∈ not_found / inactive / expired / rate_limited / error). An invalid code never fails the request. |

Optional header on any of these: `X-App-Platform: ios | android | web` — only labels the claim row.

Rate limits (in-memory, per API process): resolve 60/min per IP, claim 20/min per user,
create 20/hour per user → `429`. The same budgets apply to a `deepLinkCode` sent with login or
register, where exhaustion shows up as `deepLink.reason = "rate_limited"` instead of a 429.

Backwards compatibility: every change is additive. Existing response fields are untouched (login
and register still return the full Strapi user object), new request fields are optional.

Examples:

```bash
# resolve
curl https://api.fotbal-fm.thedevs.cz/api/v1/deep-links/7K3M9PQ2

# register through a link
curl -X POST https://api.fotbal-fm.thedevs.cz/api/v1/auth/register \
  -H 'Content-Type: application/json' -H 'X-App-Platform: android' \
  -d '{"username":"jana","email":"jana@example.com","password":"…","deepLinkCode":"7K3M9PQ2"}'

# my categories
curl -H 'Authorization: Bearer <jwt>' https://api.fotbal-fm.thedevs.cz/api/v1/me/audience-categories
curl -X PUT -H 'Authorization: Bearer <jwt>' -H 'Content-Type: application/json' \
  -d '{"audienceCategories":["rodice-u12","fanousci"]}' \
  https://api.fotbal-fm.thedevs.cz/api/v1/me/audience-categories

# invite a friend
curl -X POST -H 'Authorization: Bearer <jwt>' https://api.fotbal-fm.thedevs.cz/api/v1/deep-links
```

Swagger UI at `/docs` documents all of it.

## How a deep link travels

1. **App installed** — iOS Universal Links / Android App Links open the app straight away for
   `https://fotbal-fm.cz/a/*` (the landing page is never shown). The app reads the code and claims it
   if signed in, or keeps it pending until login/registration.
2. **Not installed, Android** — the landing page sends the visitor to Google Play with
   `referrer=deeplink%3D<code>`. The app reads it through the Play Install Referrer API on first
   launch. Deterministic.
3. **Not installed, iOS** — Apple has no install referrer. Tapping "Stáhnout v App Store" first
   copies the link to the clipboard, then opens the App Store; the app checks the pasteboard on
   first launch (one system paste prompt). Fallbacks: tap the link again after installing (Universal
   Link), or type the code shown on the page into the app.
4. **Desktop** — QR code of the same link plus store badges.

## Website

- `web/src/app/a/[code]/page.tsx` — landing page (noindex; Smart App Banner meta; platform-specific
  buttons; QR on desktop). Data via `getDeepLinkByCode()` in `web/src/lib/strapi/data.ts`, cached
  1 h under `deep-link:<CODE>`; link status is computed per request, not from the cached snapshot.
- `web/src/app/.well-known/apple-app-site-association/route.ts` and
  `web/src/app/.well-known/assetlinks.json/route.ts` — association files, `application/json`.
  Identifiers come from `config.mobileApp` (`web/src/lib/config.ts`): env `MOBILE_IOS_APP_ID`,
  `MOBILE_IOS_APP_STORE_ID`, `MOBILE_ANDROID_PACKAGE`, `MOBILE_ANDROID_SHA256_FINGERPRINTS`
  (comma-separated), `MOBILE_URL_SCHEME`; defaults are the current store builds, so production
  needs no new env vars unless the app changes.
- Cache: the Strapi webhook (`/api/cache/clear`) no longer flushes the whole site for
  `deep-link-claim` (written on every registration through a link), `deep-link` or
  `audience-category`; it deletes only `deep-link:*` / `audience-categories:*`. Strapi's own
  document middleware (`strapi/src/cache-invalidation.ts`) knows the three models too.

## Strapi admin

- **Audience Categories** — create the groups. Untick *selectable* for groups users must not pick
  themselves (e.g. partners). Order with *sortOrder*.
- **Deep Links** — enter a *name*, pick *audienceCategories*, save. `code` and `url` appear after
  saving; copy `url` and share it. Untick *active* or set *expiresAt* to retire a link. `claimsCount`
  and the *claims* list show who came through it. Links created from the app carry *createdByUser*.
- **Users** — each user's *audienceCategories* are editable; *deepLinkClaims* lists the links they
  came through.
- **Deep Link Claims** — audit list; there is no reason to create rows by hand.

Creating a link through Strapi's own REST API works as well (service token,
`POST /api/deep-links {"data":{"name":"…","audienceCategories":[ids]}}`) — the lifecycle
generates the code either way.

## Security hardening shipped with this feature

The stock users-permissions user routes have no ownership check, and the Authenticated role has
`user.find` / `user.findOne` / `user.update` enabled (the backoffice needs them so populated
`author` / `modifiedBy` relations are not stripped by Strapi's sanitizer).

- `strapi/src/extensions/users-permissions/strapi-server.ts` — for JWT callers: `find` collapses to
  the caller, `findOne` / `update` are own-profile only, `update` accepts only `firstname`,
  `lastname`, `jobTitle` (so `role`, `email`, `audienceCategories`, … cannot be set directly),
  `create` / `destroy` are refused. API-token callers keep the stock behaviour.
- `strapi/src/index.ts` `enforceUserPermissionPolicy()` — on every boot removes
  `user.create` from Public and `user.count` from Authenticated, even if re-enabled in the admin UI.

The backoffice profile update (own user, profile fields) keeps working unchanged.

## Verification checklist

```bash
# unit tests
docker compose exec -T api npx vitest run
docker compose exec -T -e REDIS_URL= web npx vitest run
docker compose exec -T web npm run lint

# association files
curl -i https://fotbal-fm.cz/.well-known/apple-app-site-association
curl -i https://fotbal-fm.cz/.well-known/assetlinks.json
```

Live checks worth repeating after a deploy: create a link in Strapi, open its `url` on a desktop
(QR page), resolve it through the API, register a throw-away user with `deepLinkCode` and confirm
the categories on the user in Strapi plus one row in Deep Link Claims.

## Related

- The legacy .NET backend on `api.fotbal-fm.cz` is retired and the app no longer calls it, so the
  app can drop `api.fotbal-fm.cz` from its associated domains and Android intent filters (the old
  `/t/` and `/i/` links). A later Cloudflare redirect from `api.fotbal-fm.thedevs.cz` to
  `api.fotbal-fm.cz` must be a 307/308 (a 301/302 turns the app's POSTs into GETs) and .NET's
  HttpClient drops the `Authorization` header on cross-host redirects — the durable fix is the
  one-line base-URL switch in the app's `ApiConfiguration.cs`. Deep links live on `fotbal-fm.cz`
  and are unaffected either way.
- The app initialises OneSignal but never identifies the user. Calling `OneSignal.Login(<Strapi
  user id>)` after login (and `Logout()` on logout) is the cheapest way to make server-side push
  targeting by audience category possible later.
