import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['web-push', 'firebase-admin', 'sanity', 'styled-components'],
  experimental: {
    proxyClientMaxBodySize: '20mb',
    serverActions: { bodySizeLimit: '10mb' },
  },
  async headers() {
    const noCache = { key: 'Cache-Control' as const, value: 'public, max-age=0, must-revalidate' }
    const noStore = { key: 'Cache-Control' as const, value: 'no-store, no-cache, must-revalidate, max-age=0' }
    return [
      { source: '/driver-sw.js', headers: [noCache] },
      { source: '/app-sw.js', headers: [noCache] },
      { source: '/customer-sw.js', headers: [noCache] },
      { source: '/customer-track-sw.js', headers: [noCache] },
      { source: '/driver/sw.js', headers: [noCache] },
      // Tenant pages (/t/*): no caching so price/content updates appear immediately
      { source: '/t/:path*', headers: [noStore] },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      // Customer PWA manifest: serve with correct Content-Type and id so app is installable (not just shortcut)
      {
        source: '/manifest.json',
        destination: '/api/manifest',
      },
      // Handle /listings/* requests (likely from bots/crawlers or Sanity Studio references)
      {
        source: '/listings/:path*',
        destination: '/',
      },
      // Icon rewrites - browsers often request icons without the full path
      {
        source: '/icon-48.png',
        destination: '/icons/icon-48x48.png',
      },
      {
        source: '/icon-72.png',
        destination: '/icons/icon-72x72.png',
      },
      {
        source: '/icon-96.png',
        destination: '/icons/icon-96x96.png',
      },
      {
        source: '/icon-128.png',
        destination: '/icons/icon-128x128.png',
      },
      {
        source: '/icon-144.png',
        destination: '/icons/icon-144x144.png',
      },
      {
        source: '/icon-152.png',
        destination: '/icons/icon-152x152.png',
      },
      {
        source: '/icon-192.png',
        destination: '/icons/icon-192x192.png',
      },
      {
        source: '/icon-256.png',
        destination: '/icons/icon-256x256.png',
      },
      {
        source: '/icon-384.png',
        destination: '/icons/icon-384x384.png',
      },
      {
        source: '/icon-512.png',
        destination: '/icons/icon-512x512.png',
      },
      // Customer PWA: use customer logo for favicon and apple-touch-icon (driver icon is served by middleware when referer has /driver)
      {
        source: '/customerLogo.webp',
        destination: '/customersLogo.webp',
      },
      {
        source: '/favicon.ico',
        destination: '/customerLogo.webp',
      },
      {
        source: '/apple-touch-icon.png',
        destination: '/customerLogo.webp',
      },
      {
        source: '/apple-touch-icon-precomposed.png',
        destination: '/customerLogo.webp',
      },
    ];
  },
};

export default nextConfig;
