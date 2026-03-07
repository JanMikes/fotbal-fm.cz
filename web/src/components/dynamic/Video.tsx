import type { ComponentVideo } from '@/lib/types';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

interface VideoProps {
  data: ComponentVideo;
}

const aspectClasses: Record<string, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-4/3',
  '1:1': 'aspect-square',
};

export function Video({ data }: VideoProps) {
  if (!data.youtube_id) return null;

  return (
    <div className={aspectClasses[data.aspect_ratio] || 'aspect-video'}>
      <iframe
        src={getYouTubeEmbedUrl(data.youtube_id)}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full rounded-lg"
      />
    </div>
  );
}
