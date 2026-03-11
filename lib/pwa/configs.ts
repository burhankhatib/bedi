/**
 * PWA Engine – Config Factories
 * Build PWAConfig objects for each role. Uses origin to construct absolute URLs.
 */

import type { PWAConfig, PWARole } from './types'
import { ROLE_ICONS, ROLE_THEME_COLORS } from './constants'

/** Get the browser origin, safe for SSR */
function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Customer Homepage PWA */
export function getCustomerPWAConfig(): PWAConfig {
  const origin = getOrigin()
  return {
    role: 'customer',
    name: 'Bedi',
    shortName: 'Bedi',
    description: 'Order from your favorite restaurants and stores. Get order updates and offers.',
    icon: ROLE_ICONS['customer'],
    startUrl: `${origin}/`,
    scope: '/',
    swUrl: '/customer-sw.js',
    manifestUrl: '/manifest.json',
    fcmEndpoint: '/api/customer/push-subscription',
    themeColor: ROLE_THEME_COLORS['customer'],
    backgroundColor: ROLE_THEME_COLORS['customer'],
    swSkipWaiting: true,
    variant: 'fixed',
  }
}

/** Per-business Customer PWA (e.g. King Broast for customers) */
export function getCustomerBusinessPWAConfig(
  slug: string,
  businessName?: string,
  businessIcon?: string
): PWAConfig {
  const origin = getOrigin()
  const name = businessName || 'Menu'
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  return {
    role: 'customer-business',
    slug,
    name,
    shortName,
    description: `${name} — Menu & order`,
    icon: businessIcon || `${origin}/t/${slug}/icon/192`,
    startUrl: `${origin}/t/${slug}`,
    scope: `/t/${slug}/`,
    // Dedicated per-business SW to keep installs independent from homepage PWA.
    swUrl: `/t/${slug}/customer-sw.js`,
    manifestUrl: `/t/${slug}/manifest.webmanifest`,
    fcmEndpoint: '/api/customer/push-subscription',
    themeColor: ROLE_THEME_COLORS['customer-business'],
    backgroundColor: ROLE_THEME_COLORS['customer-business'],
    swSkipWaiting: true,
    variant: 'fixed',
  }
}

/** Bedi Driver PWA */
export function getDriverPWAConfig(): PWAConfig {
  const origin = getOrigin()
  return {
    role: 'driver',
    name: 'Bedi Driver',
    shortName: 'Bedi Driver',
    description: 'Receive and manage delivery orders.',
    icon: ROLE_ICONS['driver'],
    startUrl: `${origin}/driver`,
    scope: '/driver/',
    swUrl: '/driver/sw.js',
    manifestUrl: '/driver/manifest.webmanifest',
    fcmEndpoint: '/api/driver/push-subscription',
    themeColor: ROLE_THEME_COLORS['driver'],
    backgroundColor: ROLE_THEME_COLORS['driver'],
    swSkipWaiting: false,
    variant: 'inline',
  }
}

/** Bedi Business Dashboard PWA (all businesses) */
export function getTenantDashboardPWAConfig(): PWAConfig {
  const origin = getOrigin()
  return {
    role: 'tenant-dashboard',
    name: 'Bedi Business',
    shortName: 'Bedi Business',
    description: 'Manage your businesses, menus, and orders. Get new order notifications for all your businesses.',
    icon: ROLE_ICONS['tenant-dashboard'],
    startUrl: `${origin}/dashboard`,
    scope: '/dashboard/',
    swUrl: '/dashboard/sw.js',
    manifestUrl: '/dashboard/manifest.webmanifest',
    fcmEndpoint: '/api/me/business-push-subscription',
    themeColor: '#f59e0b',
    backgroundColor: ROLE_THEME_COLORS['tenant-dashboard'],
    swSkipWaiting: false,
    variant: 'inline',
  }
}

/** Per-business Management PWA (e.g. "King Broast Business") */
export function getBusinessManagePWAConfig(
  slug: string,
  businessName?: string,
  businessIcon?: string
): PWAConfig {
  const origin = getOrigin()
  const baseName = businessName || 'Business'
  const name = `${baseName} Business`
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  return {
    role: 'business-manage',
    slug,
    name,
    shortName,
    description: `${baseName} — Standalone business dashboard`,
    icon: businessIcon || `${origin}/t/${slug}/icon/192`,
    startUrl: `${origin}/t/${slug}/orders`,
    scope: `/t/${slug}/`,
    swUrl: `/t/${slug}/sw.js`,
    manifestUrl: `/t/${slug}/orders/manifest.webmanifest`,
    fcmEndpoint: `/api/tenants/${slug}/push-subscription`,
    themeColor: ROLE_THEME_COLORS['business-manage'],
    backgroundColor: ROLE_THEME_COLORS['business-manage'],
    swSkipWaiting: false,
    variant: 'inline',
  }
}

/** Per-business Orders PWA (e.g. "King Broast Dashboard") */
export function getBusinessOrdersPWAConfig(
  slug: string,
  businessName?: string,
  businessIcon?: string
): PWAConfig {
  const origin = getOrigin()
  const baseName = businessName || 'Business'
  const name = `${baseName} Dashboard`
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  return {
    role: 'business-orders',
    slug,
    name,
    shortName,
    description: `${baseName} — Standalone business dashboard with order alerts`,
    icon: businessIcon || `${origin}/t/${slug}/icon/192`,
    startUrl: `${origin}/t/${slug}/orders`,
    scope: `/t/${slug}/`,
    swUrl: `/t/${slug}/orders/sw.js`,
    manifestUrl: `/t/${slug}/orders/manifest.webmanifest`,
    fcmEndpoint: `/api/tenants/${slug}/push-subscription`,
    themeColor: ROLE_THEME_COLORS['business-orders'],
    backgroundColor: ROLE_THEME_COLORS['business-orders'],
    swSkipWaiting: false,
    variant: 'inline',
  }
}

/** Get PWAConfig by role (convenience function) */
export function getPWAConfig(
  role: PWARole,
  options?: { slug?: string; businessName?: string; businessIcon?: string }
): PWAConfig {
  switch (role) {
    case 'customer':
      return getCustomerPWAConfig()
    case 'customer-business':
      return getCustomerBusinessPWAConfig(
        options?.slug || '',
        options?.businessName,
        options?.businessIcon
      )
    case 'driver':
      return getDriverPWAConfig()
    case 'tenant-dashboard':
      return getTenantDashboardPWAConfig()
    case 'business-manage':
      return getBusinessManagePWAConfig(
        options?.slug || '',
        options?.businessName,
        options?.businessIcon
      )
    case 'business-orders':
      return getBusinessOrdersPWAConfig(
        options?.slug || '',
        options?.businessName,
        options?.businessIcon
      )
  }
}
