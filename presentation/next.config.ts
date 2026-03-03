import type { NextConfig } from 'next';

const uploadsUrl = process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080';
const parsedUrl = new URL(uploadsUrl);

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@fotbal-fm/strapi-client'],
  images: {
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
