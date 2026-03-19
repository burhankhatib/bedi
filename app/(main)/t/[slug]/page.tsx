import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenantWithRestaurant } from '@/lib/tenant'
import { getSupportsDineIn } from '@/lib/constants'
import { sanityFetch } from '@/sanity/lib/fetch'
import { MENU_QUERY_TENANT } from '@/sanity/lib/queries'
import { applyProductSortToMenuData } from '@/lib/sort-menu-products'
import MenuClient from '@/components/Menu/MenuClient'
import { InitialData } from '@/app/types/menu'

export const revalidate = 3600

const defaultData: InitialData = {
  categories: [],
  popularProducts: [],
  restaurantInfo: null,
  aboutUs: null,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenantWithRestaurant(slug)
  if (!tenant) return { title: 'Not found' }

  const restaurantInfo = tenant.restaurantInfo
  const name = restaurantInfo?.name_en || restaurantInfo?.name_ar || tenant.name || 'Menu'
  const description =
    restaurantInfo?.tagline_en || restaurantInfo?.tagline_ar || `${name} — Menu & order`
  const canonicalUrl = `/t/${slug}`
  const ogImage = `${canonicalUrl}/icon/512`

  return {
    title: name,
    description,
    // Uses root Bedi Delivery manifest (/manifest.webmanifest) — no per-business PWA
    icons: {
      icon: `/t/${slug}/icon/48`,
      apple: `/t/${slug}/icon/192`,
    },
    openGraph: {
      title: name,
      description,
      url: canonicalUrl,
      siteName: 'Bedi Delivery',
      images: [{ url: ogImage, width: 512, height: 512, alt: name }],
      type: 'website',
      locale: 'en',
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [ogImage],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: name,
    },
    other: {
      'apple-mobile-web-app-title': name,
    },
  }
}

function isTenantDeactivated(tenant: { deactivated?: boolean; deactivateUntil?: string | null }): boolean {
  if (!tenant.deactivated) return false
  const until = tenant.deactivateUntil
  if (!until) return true
  return new Date(until) > new Date()
}

export default async function TenantMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const tableParam = resolvedSearchParams?.table
  const initialTableNumber = typeof tableParam === 'string' ? tableParam.trim() : Array.isArray(tableParam) ? (tableParam[0] ?? '').trim() : null
  const { slug } = await params
  const tenantFromSlug = await getTenantWithRestaurant(slug)
  if (!tenantFromSlug) notFound()
  if (tenantFromSlug.blockedBySuperAdmin) {
    redirect('/suspended?type=business')
  }
  // Hide menu when subscription/trial has expired (business hidden from system)
  const expiresAt = tenantFromSlug.subscriptionExpiresAt
  const createdAt = tenantFromSlug.createdAt
  const now = Date.now()
  const effectiveExpired =
    (expiresAt && new Date(expiresAt).getTime() <= now) ||
    (!expiresAt && createdAt && new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000 <= now)
  if (effectiveExpired) {
    notFound()
  }

  const siteId = tenantFromSlug._id
  let menuData: InitialData = defaultData

  try {
    const menuResult = await sanityFetch<InitialData>(MENU_QUERY_TENANT, { siteId }, {
      revalidate: 3600,
      tags: ['bedi-dev.store-page'],
      tag: 'store-page',
    })
    menuData = menuResult ?? defaultData
    if (menuData.categories?.length) {
      applyProductSortToMenuData(menuData.categories)
    }
  } catch (error) {
    console.error('[TenantMenu] Failed to fetch:', error)
    menuData = defaultData
  }

  const tenant = tenantFromSlug
  const isManuallyClosed = isTenantDeactivated(tenant)
  const supportsDelivery = tenant.supportsDelivery !== false
  const deliveryPricingMode = tenant.deliveryPricingMode || 'distance'
  const hasDelivery = supportsDelivery && deliveryPricingMode === 'distance'
  const businessType = tenantFromSlug.businessType ?? ''
  const supportsDineInByType = getSupportsDineIn(businessType)
  const supportsDineIn = supportsDineInByType && (tenant.supportsDineIn ?? true)
  const supportsReceiveInPerson = tenant.supportsReceiveInPerson ?? true
  // Use name_en/name_ar in MenuLayout for localized header; pass storeName only when no localized names
  const hasLocalizedName = menuData.restaurantInfo && (menuData.restaurantInfo.name_en || menuData.restaurantInfo.name_ar)
  menuData = {
    ...menuData,
    storeName: hasLocalizedName ? undefined : (tenant.name || undefined),
    supportsDineIn,
    supportsReceiveInPerson,
    hasDelivery,
    freeDeliveryEnabled: tenant.freeDeliveryEnabled ?? false,
    isManuallyClosed,
    deactivateUntil: tenant.deactivateUntil ?? null,
    businessCountry: tenant.country ?? null,
    catalogHidePrices: tenant.catalogHidePrices ?? false,
    locationLat: tenant.locationLat ?? null,
    locationLng: tenant.locationLng ?? null,
    deliveryPricingMode: deliveryPricingMode,
    deliveryFeeMin: tenant.deliveryFeeMin,
    deliveryFeeMax: tenant.deliveryFeeMax,
    requiresPersonalShopper: tenant.requiresPersonalShopper ?? false,
    supportsDriverPickup: tenant.supportsDriverPickup ?? false,
    shopperFee: tenant.shopperFee ?? 10,
  }

  return (
    <MenuClient
      initialData={menuData}
      tenantSlug={slug}
      initialTableNumber={initialTableNumber || undefined}
    />
  )
}
