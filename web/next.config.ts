import type { NextConfig } from 'next';

const uploadsUrl = process.env.INTERNAL_UPLOADS_URL || process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080';
const parsedUrl = new URL(uploadsUrl);

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@fotbal-fm/strapi-client', '@fotbal-fm/cache'],
  serverExternalPackages: ['ioredis'],
  images: {
    dangerouslyAllowSVG: true,
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: parsedUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
