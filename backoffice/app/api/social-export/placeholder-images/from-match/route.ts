import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import {
  withAuthJson,
  apiSuccess,
  ApiErrors,
  apiError,
  addApiBreadcrumb,
} from '@/lib/api';
import { ErrorCode } from '@/lib/core/errors';
import { getPublicUploadsUrl, getStrapiUrl } from '@/lib/config';
import { MatchService } from '@/lib/services';
import { getSocialExportService } from '@/lib/services/social-export.service';
import type { StrapiImage } from '@/types/match';

const fromMatchSchema = z.object({
  variantId: z.string().min(1),
  imageInputId: z.string().min(1),
  matchId: z.string().min(1),
  /** StrapiImage.id of the photo within this match's gallery. */
  imageId: z.number().int(),
  directoryId: z.string().min(1).optional(),
});

/**
 * Resolve a server-reachable URL for a match image. The mapped match exposes a
 * browser-facing public URL (PUBLIC_UPLOADS_URL/nginx) that the server container
 * can't reach on `localhost`; rewrite `/uploads/...` to the internal Strapi host.
 * Falls back to the original URL for externally-hosted media.
 */
function toInternalUrl(publicUrl: string): string {
  const publicBase = getPublicUploadsUrl();
  const path = publicUrl.startsWith(publicBase)
    ? publicUrl.slice(publicBase.length)
    : publicUrl;
  if (path.startsWith('/uploads/')) {
    return `${getStrapiUrl()}${path}`;
  }
  return publicUrl;
}

/**
 * POST /api/social-export/placeholder-images/from-match  (JSON)
 * Uploads a photo from THIS match's gallery into the slot's allowed folder and
 * returns the created gallery image. The image is resolved from the trusted
 * match record (by id) and fetched server-side — the client never supplies a URL.
 */
export const POST = withAuthJson(async (_request: NextRequest, { jwt, body }) => {
  addApiBreadcrumb('Uploading social-export placeholder image from match');

  const parsed = fromMatchSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  const { variantId, imageInputId, matchId, imageId, directoryId } = parsed.data;

  // Resolve & authorize the image strictly from the match record (no SSRF).
  const matchResult = await MatchService.forUser(jwt).getById(matchId);
  if (!matchResult.success) {
    return ApiErrors.notFound('Zápas nebyl nalezen');
  }

  const image: StrapiImage | undefined = matchResult.data.images.find((i) => i.id === imageId);
  if (!image) {
    return ApiErrors.notFound('Fotografie nebyla v zápase nalezena');
  }

  // Fetch the original bytes from the internal store.
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(toInternalUrl(image.url));
    if (!res.ok) {
      return apiError('Fotografii se nepodařilo načíst', { status: 502, code: ErrorCode.INTERNAL_ERROR });
    }
    bytes = await res.arrayBuffer();
  } catch {
    return apiError('Fotografii se nepodařilo načíst', { status: 502, code: ErrorCode.INTERNAL_ERROR });
  }

  const blob = new Blob([bytes], { type: image.mime || 'application/octet-stream' });
  const filename = image.name || `match-${matchId}-${imageId}${image.ext ?? ''}`;

  const service = getSocialExportService();
  const result = await service.uploadPlaceholderImage(variantId, imageInputId, blob, filename, directoryId);

  if (!result.success) {
    const { error } = result;
    switch (error.statusCode) {
      case 400:
        return ApiErrors.badRequest('Obrázek se nepodařilo nahrát (neplatný obrázek)');
      case 403:
        return apiError('Cílová složka není pro tento slot povolena', {
          status: 403,
          code: ErrorCode.FORBIDDEN,
        });
      case 404:
        return ApiErrors.notFound('Obrázkový slot nebyl nalezen');
      case 503:
        return apiError(error.message, { status: 503, code: error.code });
      default:
        return ApiErrors.serverError(error.message);
    }
  }

  return apiSuccess({ image: result.data });
});
