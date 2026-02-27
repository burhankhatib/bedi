import { notFound, redirect } from 'next/navigation'
import { unstable_noStore } from 'next/cache'
import type { Metadata } from 'next'
import { getTenantBySlug, getDeliveryAreasCount } from '@/lib/tenant'
import { getSupportsDineIn } from '@/lib/constants'
import { clientNoCdn } from '@/sanity/lib/client'
import { MENU_QUERY_TENANT } from '@/sanity/lib/queries'
import MenuClient from '@/components/Menu/MenuClient'
import { InitialData } from '@/app/types/menu'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const defaultData: InitialData = {
  categories: [],
  popularProducts: [],
  restaurantInfo: null,
  aboutUs: null,
}

const TENANT_FOR_MENU_QUERY = `*[_type == "tenant" && slug.current == $slug][0] {
  _id,
  name,
  deactivated,
  deactivateUntil,
  subscriptionExpiresAt,
  supportsDineIn,
  supportsReceiveInPerson,
  supportsDelivery,
  country
}`

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug, { useCdn: false })
  if (!tenant) return { title: 'Not found' }

  const restaurantInfo = await clientNoCdn.fetch<{
    name_en?: string
    name_ar?: string
    tagline_en?: string
    tagline_ar?: string
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ name_en, name_ar, tagline_en, tagline_ar }`,
    { siteId: tenant._id }
  )
  const name = restaurantInfo?.name_en || restaurantInfo?.name_ar || tenant.name || 'Menu'
  const description =
    restaurantInfo?.tagline_en || restaurantInfo?.tagline_ar || `${name} — Menu & order`
  const canonicalUrl = `/t/${slug}`
  const ogImage = `${canonicalUrl}/icon/512`

  return {
    title: name,
    description,
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
  unstable_noStore() // Force fresh fetch every request — no caching
  const { slug } = await params
  const tenantFromSlug = await getTenantBySlug(slug, { useCdn: false })
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
  type TenantForMenu = { _id: string; name: string; deactivated?: boolean; deactivateUntil?: string | null; subscriptionExpiresAt?: string | null; supportsDineIn?: boolean; supportsReceiveInPerson?: boolean; supportsDelivery?: boolean; country?: string | null }
  let tenantForMenu: TenantForMenu | null = null

  try {
    const [menuResult, tenantResult] = await Promise.all([
      clientNoCdn.fetch<InitialData>(MENU_QUERY_TENANT, { siteId }),
      clientNoCdn.fetch<TenantForMenu | null>(TENANT_FOR_MENU_QUERY, { slug }),
    ])
    menuData = menuResult ?? defaultData
    tenantForMenu = tenantResult ?? null
  } catch (error) {
    console.error('[TenantMenu] Failed to fetch:', error)
    menuData = defaultData
    tenantForMenu = { _id: siteId, name: tenantFromSlug.name, deactivated: tenantFromSlug.deactivated, deactivateUntil: tenantFromSlug.deactivateUntil, subscriptionExpiresAt: tenantFromSlug.subscriptionExpiresAt, supportsDineIn: tenantFromSlug.supportsDineIn, supportsReceiveInPerson: tenantFromSlug.supportsReceiveInPerson, supportsDelivery: tenantFromSlug.supportsDelivery, country: tenantFromSlug.country }
  }

  const tenant = tenantForMenu ?? tenantFromSlug
  const isManuallyClosed = isTenantDeactivated(tenant)
  const deliveryAreasCount = await getDeliveryAreasCount(siteId, { useCdn: false })
  const supportsDelivery = tenant.supportsDelivery !== false
  const hasDelivery = supportsDelivery && deliveryAreasCount > 0
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
    isManuallyClosed,
    deactivateUntil: tenant.deactivateUntil ?? null,
    businessCountry: tenant.country ?? null,
  }

  return (
    <MenuClient
      initialData={menuData}
      tenantSlug={slug}
      initialTableNumber={initialTableNumber || undefined}
    />
  )
}
