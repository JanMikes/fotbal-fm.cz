/**
 * How long one web → Strapi request may take (the client aborts it after this). A load of several
 * requests (the two-step page/partner load) passes a `deadline` so that all of them share this one
 * budget instead of each getting its own (review BF-V6).
 */
export const STRAPI_REQUEST_TIMEOUT_MS = 10_000;
