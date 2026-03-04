import Image from 'next/image';
import type { MediaImage } from '@/lib/types';

interface TeamLogoProps {
  name: string;
  logo: MediaImage | null;
  size: number;
  className?: string;
  fallbackClassName?: string;
}

export default function TeamLogo({ name, logo, size, className = '', fallbackClassName = '' }: TeamLogoProps) {
  if (logo) {
    return (
      <div className={`${className} relative`}>
        <Image
          src={logo.url}
          alt={logo.alternativeText ?? name}
          fill
          className="object-contain p-1"
          sizes={`${size}px`}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <span className={fallbackClassName}>
        {name.substring(0, 2).toUpperCase()}
      </span>
    </div>
  );
}
