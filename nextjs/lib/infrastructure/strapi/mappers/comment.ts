/**
 * Comment mapper.
 * Transforms raw Strapi comment data into domain Comment type.
 */

import { z } from 'zod';
import { Comment } from '@/types/comment';
import { StrapiRawComment, strapiRawUserInfoSchema } from '../types';
import { mapUserInfo } from './shared';
import { ValidationError } from '@/lib/core/errors';

/**
 * Recursive schema for comment (simplified to avoid circular reference issues)
 */
const strapiRawCommentSchema: z.ZodType<StrapiRawComment> = z.lazy(() =>
  z.object({
    id: z.number(),
    documentId: z.string(),
    content: z.string(),
    author: z.union([
      strapiRawUserInfoSchema,
      z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
    ]).nullable().optional(),
    parentComment: z.union([
      z.object({ documentId: z.string().optional() }),
      z.object({ data: z.object({ documentId: z.string().optional() }).nullable().optional() }),
    ]).nullable().optional(),
    replies: z.union([
      z.array(z.lazy(() => strapiRawCommentSchema)),
      z.object({ data: z.array(z.lazy(() => strapiRawCommentSchema)).nullable().optional() }),
    ]).nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
);

/**
 * Extract parent comment ID from various response structures
 */
function extractParentCommentId(
  parentComment: StrapiRawComment['parentComment']
): string | undefined {
  if (!parentComment) return undefined;

  // Handle nested structure: { data: { documentId } }
  if ('data' in parentComment) {
    return parentComment.data?.documentId;
  }

  // Handle flattened structure: { documentId }
  if ('documentId' in parentComment) {
    return parentComment.documentId;
  }

  return undefined;
}

/**
 * Extract replies array from various response structures
 */
function extractReplies(
  replies: StrapiRawComment['replies']
): StrapiRawComment[] | undefined {
  if (!replies) return undefined;

  // Handle nested structure: { data: [...] }
  if ('data' in replies) {
    return replies.data ?? undefined;
  }

  // Handle flattened structure: [...]
  return replies as StrapiRawComment[];
}

/**
 * Map raw Strapi comment to domain Comment
 */
export function mapComment(raw: unknown): Comment {
  // Validate raw data structure
  const parseResult = strapiRawCommentSchema.safeParse(raw);

  if (!parseResult.success) {
    console.error('[mapComment] Validation failed:', parseResult.error.issues);
    throw new ValidationError(
      'Neplatná data komentáře ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;

  // Map author - use default if missing
  const author = mapUserInfo(data.author) ?? {
    id: 0,
    firstName: '',
    lastName: '',
  };

  // Map replies recursively
  const repliesRaw = extractReplies(data.replies);
  const replies = repliesRaw && repliesRaw.length > 0
    ? repliesRaw.map(mapComment)
    : undefined;

  return {
    id: data.id,
    documentId: data.documentId,
    content: data.content,
    author,
    parentCommentId: extractParentCommentId(data.parentComment),
    replies,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi comments
 */
export function mapComments(rawArray: unknown[]): Comment[] {
  return rawArray.map(mapComment);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapComment(raw: unknown): Comment | null {
  try {
    return mapComment(raw);
  } catch (error) {
    console.error('[safeMapComment] Failed to map comment:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapComments(rawArray: unknown[]): Comment[] {
  return rawArray
    .map(safeMapComment)
    .filter((item): item is Comment => item !== null);
}
