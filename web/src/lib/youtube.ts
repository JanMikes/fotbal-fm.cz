/**
 * Extracts a YouTube embed URL from various input formats:
 * - Full URL: https://www.youtube.com/watch?v=CODE
 * - Short URL: https://youtu.be/CODE
 * - Embed URL: https://www.youtube.com/embed/CODE
 * - Just the video code: CODE
 */
export function getYouTubeEmbedUrl(input: string): string {
  const trimmed = input.trim();

  // Already an embed URL
  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed.split('?')[0];
  }

  let videoId: string | null = null;

  // youtu.be/CODE
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) {
    videoId = shortMatch[1];
  }

  // youtube.com/watch?v=CODE
  if (!videoId) {
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }
  }

  // Bare video code (no slashes, no dots)
  if (!videoId && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    videoId = trimmed;
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Fallback: return as-is
  return trimmed;
}
