const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
  serverExternalPackages: ['better-sqlite3'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ] },
      { source: '/api/:path*', headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
      ] },
    ];
  },
};

module.exports = nextConfig;
