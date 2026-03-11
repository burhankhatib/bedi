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
    const scope = config.scope.endsWith('/') ? config.scope : `${config.scope}/`
    const registration = await navigator.serviceWorker.register(config.swUrl, { scope })
    return registration
  } catch {
    return null
  }
}

/**
 * Idempotently inject or update the <link rel="manifest"> tag.
 * Removes any duplicate manifest links.
 */
export function injectManifest(manifestUrl: string): void {
  if (typeof document === 'undefined') return
  const url = manifestUrl.includes('?')
    ? `${manifestUrl}&v=${MANIFEST_VERSION}`
    : `${manifestUrl}?v=${MANIFEST_VERSION}`

  const existingLinks = Array.from(
    document.querySelectorAll('link[rel="manifest"]')
  ) as HTMLLinkElement[]

  const primaryLink = existingLinks[0] ?? document.createElement('link')
  primaryLink.setAttribute('rel', 'manifest')
  primaryLink.setAttribute('href', url)

  if (!existingLinks[0]) {
    document.head.appendChild(primaryLink)
  }

  // Remove duplicates
  for (let i = 1; i < existingLinks.length; i++) {
    existingLinks[i].remove()
  }
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
