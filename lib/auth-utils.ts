/**
 * Centralized auth redirect logic for sign-in, sign-up, and sign-out.
 * Ensures one account can be used as customer, tenant, and/or driver without confusion or errors.
 */

/** Allowed path prefixes for redirect_url (sign-in/sign-up). Prevents open redirects. */
const ALLOWED_REDIRECT_PREFIXES = [
  '/',
  '/dashboard',
  '/driver',
  '/onboarding',
  '/admin',
  '/studio',
  '/t/',
  '/join',
  '/resolve',
  '/verify-phone',
  '/sign-in',
  '/orders',
]

/**
 * Validates and returns a safe redirect path after sign-in/sign-up.
 * Returns defaultPath if redirect_url is missing, invalid, or not allowed.
 * Preserves query string (e.g. ?ref=inviterCode) for allowed paths so driver invite links work.
 */
export function getAllowedRedirectPath(
  redirectUrl: string | null | undefined,
  defaultPath: string = '/dashboard'
): string {
  if (!redirectUrl || typeof redirectUrl !== 'string') return defaultPath
  const trimmed = redirectUrl.trim()
  const [pathPart, queryPart] = trimmed.split('?')
  const path = pathPart || trimmed
  const query = queryPart ? '?' + queryPart : ''
  if (!path.startsWith('/') || path.startsWith('//')) return defaultPath
  const allowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'))
  return allowed ? path + query : defaultPath
}

/**
 * Returns the URL to redirect to after sign-out, based on current context.
 * - When on /driver: send to sign-in with redirect_url=/driver so next open goes to driver.
 * - Otherwise: send to home.
 */
export function getSignOutRedirect(currentPathname: string | null | undefined): string {
  if (currentPathname?.startsWith('/driver')) {
    return '/sign-in?redirect_url=' + encodeURIComponent('/driver')
  }
  if (currentPathname?.startsWith('/admin')) {
    return '/sign-in?redirect_url=' + encodeURIComponent('/admin')
  }
  return '/'
}

