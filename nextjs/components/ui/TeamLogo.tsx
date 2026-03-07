import Image from 'next/image';
import { TeamLogoInfo } from '@/types/match';

interface TeamLogoProps {
  name: string;
  logo: TeamLogoInfo | null;
  size?: number;
  className?: string;
}

export default function TeamLogo({ name, logo, size = 32, className = '' }: TeamLogoProps) {
  if (!logo) return null;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src={logo.url}
        alt={logo.alternativeText ?? name}
        fill
        className="object-contain"
        sizes={`${size}px`}
      />
    </div>
  );
}
