import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { isAllowedRegistrationCountry } from '@/lib/constants'
import { urlFor } from '@/sanity/lib/image'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type DayHours = { open?: string; close?: string }
type CustomDateHours = { date?: string; open?: string; close?: string }
type RestaurantInfoDoc = {
  name_en?: string
  name_ar?: string
  tagline_en?: string
  tagline_ar?: string
  address_en?: string
  address_ar?: string
  mapsLink?: string
  mapEmbedUrl?: string
  socials?: Record<string, string>
  logo?: { _type: string; asset?: { _ref: string } }
  notificationSound?: string
  openingHours?: DayHours[] | null
  customDateHours?: CustomDateHours[] | null
}

/** GET tenant + restaurantInfo for this site. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const [tenant, restaurantInfoRaw] = await Promise.all([
    clientNoCdn.fetch<{
      _id: string
      name: string
      country?: string
      city?: string
      businessType?: string
      businessSubcategories?: Array<{ _ref: string }>
      deactivated?: boolean
      deactivateUntil?: string | null
      defaultLanguage?: string | null
      supportsDineIn?: boolean
      supportsReceiveInPerson?: boolean
      supportsDelivery?: boolean
    } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{
        _id, name, country, city,
        businessType,
        "businessSubcategoryIds": businessSubcategories[]._ref,
        deactivated, deactivateUntil, defaultLanguage, supportsDineIn, supportsReceiveInPerson, supportsDelivery,
        ownerPhone, normalizedOwnerPhone
      }`,
      { tenantId: auth.tenantId }
    ),
    client.fetch<RestaurantInfoDoc | null>(
      `*[_type == "restaurantInfo" && site._ref == $siteId][0]{
        name_en, name_ar, tagline_en, tagline_ar,
        address_en, address_ar, mapsLink, mapEmbedUrl,
        socials,
        logo,
        notificationSound,
        openingHours,
        customDateHours
      }`,
      { siteId: auth.tenantId }
    ),
  ])

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const restaurantInfo = restaurantInfoRaw
    ? {
        ...restaurantInfoRaw,
        logoUrl: restaurantInfoRaw.logo ? urlFor(restaurantInfoRaw.logo).width(120).height(120).url() : null,
      }
    : null
  return NextResponse.json({ tenant, restaurantInfo })
}

/** PATCH tenant (name, country, city) and create/update restaurantInfo. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()

  if (body.country !== undefined && body.country) {
    const country = String(body.country).trim()
    if (!isAllowedRegistrationCountry(country)) {
      return NextResponse.json(
        { error: 'Registration is currently only available for Israel and Palestine. More countries will be added later.' },
        { status: 400 }
      )
    }
  }

  if (body.name != null) {
    await writeClient.patch(auth.tenantId).set({ name: String(body.name) }).commit()
  }
  if (body.businessType != null) {
    const validTypes = ['restaurant', 'cafe', 'bakery', 'grocery', 'retail', 'pharmacy', 'other']
    const bt = String(body.businessType).trim()
    if (validTypes.includes(bt)) {
      await writeClient.patch(auth.tenantId).set({ businessType: bt }).commit()
      if (!body.businessSubcategoryIds?.length) {
        await writeClient.patch(auth.tenantId).unset(['businessSubcategories']).commit()
      }
    }
  }
  if (body.businessSubcategoryIds !== undefined) {
    const ids = Array.isArray(body.businessSubcategoryIds)
      ? body.businessSubcategoryIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '').map((id: string) => id.trim())
      : []
    if (ids.length > 0) {
      await writeClient
        .patch(auth.tenantId)
        .set({
          businessSubcategories: ids.map((id: string, i: number) => ({ _type: 'reference' as const, _key: `sub-${i}`, _ref: id })),
        })
        .commit()
    } else {
      await writeClient.patch(auth.tenantId).unset(['businessSubcategories']).commit()
    }
  }
  if (body.country !== undefined) {
    await writeClient.patch(auth.tenantId).set({ country: body.country ? String(body.country) : null }).commit()
  }
  if (body.city !== undefined) {
    await writeClient.patch(auth.tenantId).set({ city: body.city ? String(body.city) : null }).commit()
  }
  if (body.deactivated !== undefined) {
    await writeClient.patch(auth.tenantId).set({ deactivated: Boolean(body.deactivated) }).commit()
  }
  if (body.deactivateUntil !== undefined) {
    const v = body.deactivateUntil
    await writeClient.patch(auth.tenantId).set({ deactivateUntil: v === null || v === '' ? null : String(v) }).commit()
  }
  if (body.defaultLanguage !== undefined) {
    const v = body.defaultLanguage
    await writeClient.patch(auth.tenantId).set({ defaultLanguage: v === null || v === '' ? null : (v === 'en' ? 'en' : 'ar') }).commit()
  }
  if (body.supportsDineIn !== undefined) {
    await writeClient.patch(auth.tenantId).set({ supportsDineIn: Boolean(body.supportsDineIn) }).commit()
  }
  if (body.supportsReceiveInPerson !== undefined) {
    await writeClient.patch(auth.tenantId).set({ supportsReceiveInPerson: Boolean(body.supportsReceiveInPerson) }).commit()
  }
  if (body.supportsDelivery !== undefined) {
    await writeClient.patch(auth.tenantId).set({ supportsDelivery: Boolean(body.supportsDelivery) }).commit()
  }
  if (body.ownerPhone !== undefined) {
    const { normalizePhoneDigits } = await import('@/lib/order-auth')
    const raw = typeof body.ownerPhone === 'string' ? body.ownerPhone.trim() : ''
    if (raw) {
      let digits = normalizePhoneDigits(raw)
      if (digits.startsWith('0') && digits.length === 10) digits = '972' + digits.slice(1)
      if (digits) {
        await writeClient.patch(auth.tenantId).set({ ownerPhone: raw, normalizedOwnerPhone: digits }).commit()
      }
    } else {
      await writeClient.patch(auth.tenantId).unset(['ownerPhone', 'normalizedOwnerPhone']).commit()
    }
  }

  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ _id }`,
    { siteId: auth.tenantId }
  )

  const restFields = {
    name_en: body.name_en,
    name_ar: body.name_ar,
    tagline_en: body.tagline_en,
    tagline_ar: body.tagline_ar,
    address_en: body.address_en,
    address_ar: body.address_ar,
    mapsLink: body.mapsLink,
    mapEmbedUrl: body.mapEmbedUrl,
    socials: body.socials,
    logoAssetId: body.logoAssetId,
    notificationSound: body.notificationSound,
    openingHours: body.openingHours,
    customDateHours: body.customDateHours,
  }

  const restPatch: Record<string, unknown> = {}
  if (restFields.name_en != null) restPatch.name_en = restFields.name_en
  if (restFields.name_ar != null) restPatch.name_ar = restFields.name_ar
  if (restFields.tagline_en !== undefined) restPatch.tagline_en = restFields.tagline_en
  if (restFields.tagline_ar !== undefined) restPatch.tagline_ar = restFields.tagline_ar
  if (restFields.address_en !== undefined) restPatch.address_en = restFields.address_en
  if (restFields.address_ar !== undefined) restPatch.address_ar = restFields.address_ar
  if (restFields.mapsLink !== undefined) restPatch.mapsLink = restFields.mapsLink
  if (restFields.mapEmbedUrl !== undefined) restPatch.mapEmbedUrl = restFields.mapEmbedUrl
  if (restFields.socials !== undefined) restPatch.socials = restFields.socials
  if (restFields.logoAssetId != null && restFields.logoAssetId !== '') {
    restPatch.logo = { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: String(restFields.logoAssetId) } }
  }
  if (restFields.notificationSound !== undefined) {
    restPatch.notificationSound = restFields.notificationSound ? String(restFields.notificationSound) : '1.wav'
  }
  if (restFields.openingHours !== undefined) {
    restPatch.openingHours = Array.isArray(restFields.openingHours)
      ? restFields.openingHours.slice(0, 7).map((d: DayHours, i: number) => ({
          _key: `day-${i}`,
          _type: 'object',
          open: d?.open ?? '',
          close: d?.close ?? '',
        }))
      : []
  }
  if (restFields.customDateHours !== undefined) {
    const custom = Array.isArray(restFields.customDateHours)
      ? restFields.customDateHours.filter((d: CustomDateHours) => d?.date).map((d: CustomDateHours, i: number) => ({
          _key: `custom-${i}-${d.date ?? ''}`,
          _type: 'object',
          date: d.date ?? '',
          open: d?.open ?? '',
          close: d?.close ?? '',
        }))
      : []
    restPatch.customDateHours = custom
  }

  if (Object.keys(restPatch).length > 0) {
    if (existing) {
      await writeClient.patch(existing._id).set(restPatch).commit()
    } else {
      await writeClient.create({
        _type: 'restaurantInfo',
        site: { _type: 'reference' as const, _ref: auth.tenantId },
        name_en: (body.name_en != null && body.name_en !== '') ? String(body.name_en) : 'Store',
        name_ar: (body.name_ar != null && body.name_ar !== '') ? String(body.name_ar) : 'متجر',
        ...restPatch,
      })

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      await writeClient.patch(auth.tenantId).set({
        businessCreatedAt: now.toISOString(),
        subscriptionExpiresAt: expiresAt.toISOString(),
      }).commit()
    }
    if (restPatch.logo) {
      await writeClient.patch(auth.tenantId).set({ businessLogo: restPatch.logo }).commit()
    }
  }

  return NextResponse.json({ ok: true })
}
