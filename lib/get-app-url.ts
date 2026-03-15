/**
 * Returns the app base URL for FCM/push links and absolute URLs.
 * Ensures links open in the correct PWA/website domain.
 */
export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (base) {
    return base.startsWith('http') ? base.replace(/\/$/, '') : `https://${base}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return ''
}

/** Build full URL from path (e.g. /admin/reports -> https://bedi.delivery/admin/reports) */
export function getAppUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getAppBaseUrl()
  return base ? `${base}${p}` : p
}
