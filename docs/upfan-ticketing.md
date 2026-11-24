# Ticket sales through Upfan

Fans buy tickets (and season tickets) inside the mobile app. **Upfan** sells them: it runs
the catalog, the holds, buyer verification, payment and the gate scanners. Our app does the
shopping UI and shows the tickets, and our API is the only party that talks to Upfan.

- Upfan partner API v1: <https://docs.upfan.io> (Swagger, login in the password manager). Contact: Jakub (Upfan).
- Mobile-side instructions (Czech, handed over as PDF): `docs/upfan-mobilni-aplikace-instrukce.md`.
- Code: `api/src/lib/upfan.ts` (client), `api/src/lib/ticketing.ts` (flow), `api/src/routes/tickets.ts`,
  `web/src/app/upfan/[...path]/page.tsx` (return fallback pages), `web/src/lib/app-links.ts`.

## Environments

| | Sandbox (test payments) | Production |
|---|---|---|
| Upfan API | `https://api.upfan.dev/api/partner/v1` | `https://api.upfan.io/api/partner/v1` |
| Our credentials (api env) | `UPFAN_SANDBOX_CLIENT_ID` / `_SECRET` | `UPFAN_PRODUCTION_CLIENT_ID` / `_SECRET` (secret only after the joint test with Upfan) |
| Who buys there | users with `ticketingTester = true` (Strapi admin → Uživatel) | everyone else |
| Buyer return | `https://fotbal-fm.cz/upfan/test/buyer-return` | `https://fotbal-fm.cz/upfan/buyer-return` |
| Payment return | `https://fotbal-fm.cz/upfan/test/payment-return` | `https://fotbal-fm.cz/upfan/payment-return` |

One app build, one API. The environment is chosen per account when a purchase starts and is then
stored on the purchase. Changing the tester flag mid-purchase changes nothing. **Fail closed:** an
environment without credentials is never used. A non-tester never falls back to the sandbox, the shop
answers `available: false`, and starting a purchase answers 503. Until the production secret arrives,
only testers can buy.

The return URLs are registered at Upfan per environment (exact match; a sandbox call with a production
URL is rejected, `E_PARTNER_CONNECTION_RETURN_URL_NOT_ALLOWED`). `UPFAN_RETURN_BASE_URL` (default
`https://fotbal-fm.cz`) builds them. Change it only together with the registration at Upfan.

## Buyer identification: `UPFAN_BUYER_MODE`

Upfan needs a buyer token to create an order.

- **`guest`** (default): `POST /guest-buyer-sessions` → Upfan panel → `POST …/redemptions`. Upfan verifies the
  e-mail **on every purchase**. We send no personal data. The handle (`onboardingId`) lives on the
  purchase and can be redeemed for 30 min after the panel is completed.
- **`account`**: `POST /buyer-sessions` with `externalSubject` = the Strapi user `documentId` (immutable,
  never e-mail or numeric id), e-mail, names, `emailVerified: true`. The first purchase shows the panel,
  later ones go straight to payment.

**Why `guest` is the default:** Upfan's contract allows `emailVerified: true` only for e-mails *we*
verified. Ours are not: Strapi `email_confirmation` is off, so registration returns a JWT immediately
and `confirmed` is always true. Switch to `account` only after Upfan agrees, or after we verify e-mails
ourselves. The partner API has no unlink, so the `externalSubject` choice is permanent.

## Flow

```
app                         our API                                  Upfan
POST /ticket-purchases ──►  create ticket-purchase row (reference)
                            guest/buyer session ─────────────────►   202 panel URL
◄── buyer_verification + nextAction(panel URL)
open panel in system browser … buyer verifies e-mail / fills profile …
◄── https://fotbal-fm.cz/upfan[/test]/buyer-return?upfan_onboarding=success (App Link)
POST /ticket-purchases/{ref}/resume ──► redeem / buyer session ──►   201 buyer token
                            reserve (Idempotency-Key = reference) ►  hold 15 min
                            create order (externalReference = ref) ► payment URL
◄── payment + nextAction(payment URL)
open payment page … pays …
◄── …/payment-return?order_reference=<uuid> (App Link)
GET /ticket-purchases/{ref} (every pollAfterMs) ──► GET /orders/{id} (throttled)
◄── success → GET /me/tickets ──► GET /orders/{id}/tickets (QR payload)
```

- The buyer is verified **before** the hold, so no reservation sits idle while someone types an OTP.
- A return link proves nothing. The app always asks our API, which asks Upfan. `order_reference` from
  the link is never used for lookups. Everything goes through the caller's own `ticket-purchase` row,
  because the machine token can read every sale of the integration.
- Retries are idempotent: the reservation `Idempotency-Key` and the order `externalReference` are both our
  `reference`. Concurrent calls for one purchase are serialized in-process (`withLock`).
- A new purchase cancels the caller's unfinished `buyer_verification` purchases (releasing any hold).
  A purchase in `payment` cannot be cancelled through the API.

### Purchase states (`ticket-purchase.status`)

| Status | Meaning | `failureCode` |
|---|---|---|
| `buyer_verification` | waiting for the Upfan panel (10 min) | |
| `payment` | order created, waiting for payment (polled) | |
| `success` | paid, tickets issued | |
| `failure` | stopped | `sold_out`, `inventory_limit`, `event_unavailable`, `order_rejected`, `payment_failed` |
| `expired` | panel or hold ran out | `onboarding_expired`, `reservation_expired` |
| `cancelled` | by the user (or superseded by a new purchase) | |

## Limits (per integration, shared by everyone)

300 requests/min including polling (writes 60, PDFs 10, new panels 30), and at most **100 unpaid held
tickets** including pending orders. What we do about them:
- `UpfanBudget` caps us at 270/55 per minute and fails fast (`503 reason=busy` + `Retry-After`), and a 429
  blocks the environment for its `Retry-After`;
- the catalog is cached 60 s, tickets 30 s, and the machine token until shortly before expiry;
- each order is asked at most every 2 s for the first minute, then every 5 s up to 5 min, then every 15 s.
  Upfan is polled only when the purchase owner asks; there is no background job;
- PDFs are not offered (the QR payload is enough, and PDFs have a 10/min budget).

Upfan has no webhooks. A fan who pays and never reopens the app is settled on their next
`GET /ticket-purchases` or `/me/tickets` call.

## API (`/api/v1`, Bearer JWT)

| Method | Path | |
|---|---|---|
| GET | `/tickets/shop` | `{ available, environment, events[] }`. Events with `categories[]` (`unitAmount` in haléře, `maxQuantity`, `purchasable`, `unavailableReason`). `description` = HTML from Upfan's Markdown (raw HTML escaped), `descriptionText` = plain. |
| POST | `/ticket-purchases` | `{ eventId, ticketCategoryId, quantity }` → 201 purchase |
| GET | `/ticket-purchases` | the caller's purchases, newest first |
| GET | `/ticket-purchases/{reference}` | state confirmed with Upfan (throttled; honour `pollAfterMs`) |
| POST | `/ticket-purchases/{reference}/resume` | after buyer-return: verification → hold → order |
| POST | `/ticket-purchases/{reference}/cancel` | 409 once the order waits for payment |
| GET | `/me/tickets` | tickets of successful purchases. `qrCode` = static admission payload (render verbatim). Refunded tickets disappear. |

Errors: 401, 404 (not the caller's), 409, 422 (`reason`), 429 (our per-user limit), 503 (`reason` =
`unavailable` | `busy` | `upfan_error`).

## Data

- `ticket-purchase` (Strapi, service-token only, `ignored` in the cache-tag map): our id `reference`
  (`fkfm-<uuid>`), user, environment, buyerMode, status, event/category snapshot, quantity, amounts,
  onboarding handle/URL/expiry, reservation id/expiry, Upfan order id, payment URL, failureCode.
- `user.ticketingTester` (admin-only; the profile whitelist in `extensions/users-permissions/strapi-server.ts`
  rejects it from the user's own PUT).

Onboarding and payment URLs carry short-lived secrets. They are stored on the purchase so the app can
reopen them, and they are never logged. Errors log only the HTTP status and Upfan's error code.

## Not in v1 / open

- Upfan events are not matched to our `match` records. The shop lists Upfan events as they come (the
  first sandbox event is season tickets).
- No refunds, cancellations of paid orders or ticket transfers through the API: the club handles them with
  Upfan. Refunded tickets vanish from `/me/tickets`.
- Account deletion does not reach Upfan (no API). The procedure is to be agreed with Upfan.
- Before production: joint test with Upfan (test purchase, return into the app, QR scan at the gate), then
  the production secret into the lily api env.
