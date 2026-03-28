/**
 * Clerk + Capacitor native OAuth redirect.
 *
 * The redirect URL must be allow-listed in Clerk (Dashboard → SSO / OAuth / Redirect URLs
 * or Native app settings) exactly as returned by {@link resolveNativeOAuthRedirectUrl}.
 *
 * Android `applicationId` / iOS bundle ID / `capacitor.config.ts` `appId` must all match
 * the identifier you register in Clerk → Native applications.
 */

import { Capacitor } from '@capacitor/core'

export const NATIVE_OAUTH_HOST = 'oauth-callback'

const KNOWN_APP_IDS = {
  customer: 'com.burhankhatib.bedi',
  driver: 'com.burhankhatib.bedi.driver',
  tenant: 'com.burhankhatib.bedi.tenant',
} as const

export type CapacitorAppKind = keyof typeof KNOWN_APP_IDS

/** Optional override when the web path heuristic is wrong (single bundle testing, etc.). */
export function getCapacitorAppIdFromEnv(): string | null {
  const v = process.env.NEXT_PUBLIC_CAPACITOR_APP_ID?.trim()
  return v || null
}

/**
 * Infer which native shell we are in from the loaded URL (each Capacitor app uses a different server.url path).
 */
export function inferCapacitorAppKindFromPath(pathname: string): CapacitorAppKind {
  if (pathname === '/driver' || pathname.startsWith('/driver/')) return 'driver'
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) return 'tenant'
  return 'customer'
}

export function getCapacitorAppIdForPath(pathname: string): string {
  const fromEnv = getCapacitorAppIdFromEnv()
  if (fromEnv) return fromEnv
  const kind = inferCapacitorAppKindFromPath(pathname)
  return KNOWN_APP_IDS[kind]
}

/**
 * Clerk redirect after IdP — opens the app via platform URL handler (Android intent / iOS URL type).
 * Pattern: `<applicationId>://oauth-callback`
 *
 * On native, uses `@capacitor/app` `App.getInfo().id` so it stays correct even on shared routes
 * like `/sign-in` (driver app is no longer inferred only from `/driver` in the path).
 */
export async function resolveNativeOAuthRedirectUrl(): Promise<string> {
  const fromEnv = getCapacitorAppIdFromEnv()
  if (fromEnv) return `${fromEnv}://${NATIVE_OAUTH_HOST}`

  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const { App } = await import('@capacitor/app')
      const { id } = await App.getInfo()
      if (id?.trim()) return `${id.trim()}://${NATIVE_OAUTH_HOST}`
    } catch (err) {
      console.warn('App.getInfo() failed, falling back to path inference.', err)
    }
  }

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  return `${getCapacitorAppIdForPath(pathname)}://${NATIVE_OAUTH_HOST}`
}

const RETURN_TO_KEY = 'clerk_oauth_return_to'

export function storeOAuthReturnTo(returnTo: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo)
  } catch {
    /* ignore */
  }
}

export function consumeOAuthReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    return v
  } catch {
    return null
  }
}

/** True if `event.url` from App.addListener('appUrlOpen') is our Clerk OAuth return. */
export function isNativeOAuthCallbackDeepLink(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const scheme = url.protocol.replace(/:$/, '')
    const known = new Set<string>(Object.values(KNOWN_APP_IDS))
    if (!known.has(scheme)) return false
    // com.app.id://oauth-callback?query → hostname is "oauth-callback", pathname ""
    if (url.hostname === NATIVE_OAUTH_HOST) return true
    if (url.pathname === `/${NATIVE_OAUTH_HOST}` || url.pathname === NATIVE_OAUTH_HOST) return true
    return false
  } catch {
    return false
  }
}

export function nativeOAuthCallbackSearchParams(urlString: string): string {
  try {
    const url = new URL(urlString)
    return url.search || ''
  } catch {
    return ''
  }
}
