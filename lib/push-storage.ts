/**
 * Client-side storage for "user is subscribed to push" to avoid calling the API/Sanity on every load.
 * When permission is granted and we have a stored success, we trust it and skip GET.
 * Only call the API when we're unsure (e.g. first visit, or permission granted but no stored flag).
 */

const PREFIX = 'zonify_push_'

function key(contextKey: string): string {
  return PREFIX + contextKey
}

/** True if we previously saved a successful push subscription for this context. */
export function getStoredPushOk(contextKey: string): boolean {
  if (typeof window === 'undefined' || !contextKey) return false
  try {
    return localStorage.getItem(key(contextKey)) === '1'
  } catch {
    return false
  }
}

/** Call after a successful POST (subscribe). So next load we skip the GET. */
export function setStoredPushOk(contextKey: string): void {
  if (typeof window === 'undefined' || !contextKey) return
  try {
    localStorage.setItem(key(contextKey), '1')
  } catch {
    // private mode / quota
  }
}

/** Call when we know the user is not subscribed (e.g. permission denied or API said false). */
export function clearStoredPushOk(contextKey: string): void {
  if (typeof window === 'undefined' || !contextKey) return
  try {
    localStorage.removeItem(key(contextKey))
  } catch {
    // ignore
  }
}

/** Context keys for each flow (must match what we use in providers). */
export const PUSH_CONTEXT_KEYS = {
  tenant: (slug: string) => `tenant_${slug}`,
  business: () => 'business',
  driver: () => 'driver',
  customer: (slug: string, token: string) => `customer_${slug}_${token}`,
} as const
