import type { MetadataRoute } from 'next'

/**
 * Customer PWA manifest — Next.js native manifest file.
 * Served at /manifest.webmanifest and auto-injected as
 * <link rel="manifest"> in every page's server-rendered HTML.
 *
 * Child pages override this via generateMetadata({ manifest: ... }):
 *   /driver/*  → uses the driver manifest (from driver layout metadata)
 *   /dashboard/* → uses the dashboard manifest (from dashboard layout metadata)
 *   /t/[slug]  → uses this Bedi Delivery manifest (no per-business PWA)
 *
 * Using relative URLs here (no origin required) — the browser resolves
 * them against the manifest URL origin, which is the same as the app origin.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Bedi Delivery',
    short_name: 'Bedi Delivery',
    description: 'Order from your favorite restaurants and stores. Get order updates and offers.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    icons: [
      { src: '/customersLogo.webp', sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: '/customersLogo.webp', sizes: '512x512', type: 'image/webp', purpose: 'any' },
      { src: '/customersLogo.webp', sizes: '192x192', type: 'image/webp', purpose: 'maskable' },
      { src: '/customersLogo.webp', sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
    ],
    categories: ['food', 'shopping', 'lifestyle'],
  }
}
