/**
 * PWA Engine – Service Worker Registration & Manifest Injection
 * Handles registering the SW for a given PWAConfig and setting the manifest link.
 */

import type { PWAConfig } from './types'
import { MANIFEST_VERSION } from './constants'

/**
 * Register the service worker for the given PWA config.
 * Returns the registration or null if SW is not supported.
 */
export async function registerServiceWorker(
  config: PWAConfig
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    // Register with the exact configured scope first (important for scopes like /t/[slug]).
    return await navigator.serviceWorker.register(config.swUrl, { scope: config.scope })
  } catch {
    // Fallback for legacy configs that expect trailing slash scopes.
    try {
      const fallbackScope = config.scope.endsWith('/') ? config.scope : `${config.scope}/`
      return await navigator.serviceWorker.register(config.swUrl, { scope: fallbackScope })
    } catch {
      return null
    }
  }
}

/**
 * Idempotently inject or update the <link rel="manifest"> tag.
 * CRITICAL: Removes ALL existing manifest links first, then creates
 * a fresh one with the correct URL. This prevents Chrome from seeing
 * a stale/inherited manifest (e.g. the customer manifest on /t/[slug])
 * and reporting "This app is already installed."
 */
export function injectManifest(manifestUrl: string): void {
  if (typeof document === 'undefined') return
  const url = manifestUrl.includes('?')
    ? `${manifestUrl}&v=${MANIFEST_VERSION}`
    : `${manifestUrl}?v=${MANIFEST_VERSION}`

  // Remove ALL existing manifest links (including Next.js server-rendered ones)
  const existingLinks = Array.from(
    document.querySelectorAll('link[rel="manifest"]')
  ) as HTMLLinkElement[]
  for (const link of existingLinks) {
    link.remove()
  }

  // Create a fresh manifest link
  const newLink = document.createElement('link')
  newLink.setAttribute('rel', 'manifest')
  newLink.setAttribute('href', url)
  document.head.appendChild(newLink)
}

/**
 * Get an existing registration for a scope, or null.
 */
export async function getRegistration(
  scope: string
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration(scope)) ?? null
  } catch {
    return null
  }
}
