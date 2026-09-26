import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'community.akamai.steamstatic.com',
                port: '',
                pathname: '/economy/image/**',
                search: '',
            },
        ],
        minimumCacheTTL: 60 * 60 * 24 * 7,
        maximumRedirects: 0,
        formats: ['image/webp'],
    },
};

export default nextConfig;
