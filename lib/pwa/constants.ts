/**
 * PWA Engine – Constants
 * All shared constants for the PWA system.
 */

/** Manifest version string appended as ?v= to manifest URLs */
export const MANIFEST_VERSION = '20260312'

/** Default dismiss durations */
export const DISMISS_HOURS_DEFAULT = 24
export const DISMISS_HOURS_EXTENDED = 24 * 7 // 7 days

/** localStorage key prefix for install dismiss state (appended with role) */
export const STORAGE_KEY_INSTALL_PREFIX = 'bedi-pwa-install-dismissed-'

/** sessionStorage key for permissions card dismiss */
export const STORAGE_KEY_PERMISSIONS_DISMISSED = 'bedi-pwa-permissions-dismissed'

/** Scroll threshold (pixels) before showing install prompt */
export const SCROLL_THRESHOLD = 250

/** Delay (ms) before auto-showing install prompt */
export const AUTO_SHOW_DELAY_MS = 14000

/** Default icons per role */
export const ROLE_ICONS: Record<string, string> = {
  'customer': '/customersLogo.webp',
  'customer-business': '/customersLogo.webp', // overridden by business logo
  'driver': '/driversLogo.webp',
  'tenant-dashboard': '/adminslogo.webp',
  'business-manage': '/adminslogo.webp',  // overridden by business logo
  'business-orders': '/adminslogo.webp',  // overridden by business logo
}

/** Default theme colors per role */
export const ROLE_THEME_COLORS: Record<string, string> = {
  'customer': '#0f172a',
  'customer-business': '#0f172a',
  'driver': '#020617',
  'tenant-dashboard': '#020617',
  'business-manage': '#0f172a',
  'business-orders': '#0f172a',
}

/** Default notification tags per role */
export const ROLE_NOTIFICATION_TAGS: Record<string, string> = {
  'customer': 'bedi-customer',
  'customer-business': 'bedi-customer',
  'driver': 'bedi-driver-delivery',
  'tenant-dashboard': 'bedi-business-new-order',
  'business-manage': 'bedi-tenant-order-update',
  'business-orders': 'bedi-tenant-order-update',
}

/** Default notification titles per role */
export const ROLE_NOTIFICATION_TITLES: Record<string, string> = {
  'customer': 'Bedi',
  'customer-business': 'Bedi',
  'driver': 'New delivery request',
  'tenant-dashboard': 'New order',
  'business-manage': 'New order',
  'business-orders': 'طلب جديد',
}

/** Default URLs for notification click per role */
export const ROLE_DEFAULT_URLS: Record<string, string> = {
  'customer': '/',
  'customer-business': '/',
  'driver': '/driver/orders',
  'tenant-dashboard': '/dashboard',
  'business-manage': '/',
  'business-orders': '/',
}

/** Roles where SW should skipWaiting immediately on install — all roles now skip waiting
 * so dedicated SWs immediately displace the root customer SW (scope /) and take control
 * of their specific scope. Without this Chrome keeps the root SW as controller and shows
 * "This app is already installed" for any sub-scope page. */
export const SKIP_WAITING_ROLES = new Set([
  'customer',
  'customer-business',
  'driver',
  'tenant-dashboard',
  'business-manage',
  'business-orders',
])

/** Default notification direction per role */
export const ROLE_DEFAULT_DIR: Record<string, 'ltr' | 'rtl'> = {
  'customer': 'ltr',
  'customer-business': 'ltr',
  'driver': 'ltr',
  'tenant-dashboard': 'ltr',
  'business-manage': 'ltr',
  'business-orders': 'rtl',
}
