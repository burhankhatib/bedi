import { NextRequest, NextResponse } from 'next/server'
import { auth as clerkAuth, clerkClient } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { slugify } from '@/lib/slugify'
import { isVerifiedPhoneForUser } from '@/lib/order-auth'
import { isAllowedRegistrationCountry } from '@/lib/constants'
import { getAllowedBusinessTypeValues } from '@/lib/allowed-business-types'
import { urlFor } from '@/sanity/lib/image'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type DayHours = { open?: string; close?: string; shifts?: { open?: string; close?: string }[] }
type CustomDateHours = { date?: string; open?: string; close?: string; shifts?: { open?: string; close?: string }[] }
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

/** GET tenant + restaurantInfo for this site. ?refresh=1 forces fresh data (bypasses CDN). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const tenantClient = refresh ? clientNoCdn : client
  const restaurantClient = refresh ? clientNoCdn : client

  const [tenant, restaurantInfoRaw] = await Promise.all([
    tenantClient.fetch<{
      _id: string
      name: string
      slug?: string
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
      freeDeliveryEnabled?: boolean
      supportsDriverPickup?: boolean
      defaultAutoDeliveryRequestMinutes?: number | null
      saveAutoDeliveryRequestPreference?: boolean
      catalogHidePrices?: boolean
      prioritizeWhatsapp?: boolean
      ownerPhone?: string
      normalizedOwnerPhone?: string
      locationLat?: number
      locationLng?: number
    } | null>(
      `*[_type == "tenant" && _id == $tenantId][0]{
        _id, name, "slug": slug.current, country, city,
        businessType,
        "businessSubcategoryIds": businessSubcategories[]._ref,
        deactivated, deactivateUntil, defaultLanguage, supportsDineIn, supportsReceiveInPerson, supportsDelivery, freeDeliveryEnabled, supportsDriverPickup,
        defaultAutoDeliveryRequestMinutes, saveAutoDeliveryRequestPreference,
        catalogHidePrices, prioritizeWhatsapp,
        ownerPhone, normalizedOwnerPhone, locationLat, locationLng
      }`,
      { tenantId: auth.tenantId }
    ),
    restaurantClient.fetch<RestaurantInfoDoc | null>(
      `*[_type == "restaurantInfo" && site._ref == $siteId][0]{
        name_en, name_ar, tagline_en, tagline_ar,
        address_en, address_ar,
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

  // Sync with Clerk verified phone
  try {
    const { userId } = await clerkAuth()
    if (userId) {
      const clientClerk = await clerkClient()
      const user = await clientClerk.users.getUser(userId)
      const primaryPhoneId = user.primaryPhoneNumberId
      const primaryPhone = user.phoneNumbers.find(p => p.id === primaryPhoneId)
      if (primaryPhone && primaryPhone.verification?.status === 'verified') {
        let clerkPhone = primaryPhone.phoneNumber
        if (clerkPhone.startsWith('+')) {
          clerkPhone = clerkPhone.substring(1)
        }
        const { normalizePhoneDigits } = await import('@/lib/order-auth')
        const sanityPhoneNorm = normalizePhoneDigits(tenant.ownerPhone || '')
        const clerkPhoneNorm = normalizePhoneDigits(clerkPhone)
        if (clerkPhoneNorm && sanityPhoneNorm !== clerkPhoneNorm) {
          await writeClient.patch(tenant._id).set({ ownerPhone: clerkPhone, normalizedOwnerPhone: clerkPhoneNorm }).commit()
          tenant.ownerPhone = clerkPhone // update returned doc
          tenant.normalizedOwnerPhone = clerkPhoneNorm
        }
      }
    }
  } catch (e) {
    console.error('[API] Sync tenant phone error:', e)
  }

  const restaurantInfo = restaurantInfoRaw
    ? {
        ...restaurantInfoRaw,
        logoUrl: restaurantInfoRaw.logo ? urlFor(restaurantInfoRaw.logo).width(120).height(120).url() : null,
      }
    : null
  // Tenant-specific + auth: never allow shared CDN caching of this JSON (stale flags e.g. prioritizeWhatsapp after PATCH).
  return NextResponse.json(
    { tenant, restaurantInfo },
    { headers: { 'Cache-Control': 'private, no-store, must-revalidate' } }
  )
}

/** PATCH tenant (name, country, city) and create/update restaurantInfo. Batched into 1–2 Sanity commits for speed. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()

  // Validation only (no writes yet)
  if (body.country !== undefined && body.country) {
    const country = String(body.country).trim()
    if (!isAllowedRegistrationCountry(country)) {
      return NextResponse.json(
        { error: 'Registration is currently only available for Israel and Palestine. More countries will be added later.' },
        { status: 400 }
      )
    }
  }

  if (body.ownerPhone !== undefined) {
    const raw = typeof body.ownerPhone === 'string' ? body.ownerPhone.trim() : ''
    if (raw) {
      const { userId } = await clerkAuth()
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const isVerified = await isVerifiedPhoneForUser(userId, raw)
      if (!isVerified) {
        return NextResponse.json(
          { error: 'This phone number must be verified first. You will be redirected to verify it.', code: 'MUST_VERIFY_PHONE' },
          { status: 400 }
        )
      }
    }
  }

  let slugRedirectTo: string | undefined
  if (body.slugNew !== undefined && typeof body.slugNew === 'string') {
    const rawSlug = body.slugNew.trim()
    const newSlug = slugify(rawSlug || '')
    if (!newSlug) {
      return NextResponse.json(
        { error: 'Invalid URL slug. Use only letters, numbers, and hyphens (e.g. my-restaurant).' },
        { status: 400 }
      )
    }
    if (newSlug !== slug) {
      const existing = await client.fetch<{ _id: string } | null>(
        `*[_type == "tenant" && slug.current == $s && _id != $tenantId][0]{ _id }`,
        { s: newSlug, tenantId: auth.tenantId }
      )
      if (existing) {
        return NextResponse.json(
          { error: 'This URL is already taken by another business. Choose a different slug.' },
          { status: 409 }
        )
      }
      slugRedirectTo = `/t/${encodeURIComponent(newSlug)}/manage/business`
    }
  }

  // Fetch restaurantInfo once (needed for create vs patch)
  const existingRest = await client.fetch<{ _id: string } | null>(
    `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ _id }`,
    { siteId: auth.tenantId }
  )

  // Build tenant patch (single object; merge into one commit)
  const tenantSet: Record<string, unknown> = {}
  const tenantUnset: string[] = []

  if (body.name != null) tenantSet.name = String(body.name)
  if (body.businessType != null) {
    const validTypes = await getAllowedBusinessTypeValues()
    const bt = String(body.businessType).trim()
    if (validTypes.has(bt)) tenantSet.businessType = bt
  }
  if (body.businessSubcategoryIds !== undefined) {
    const ids = Array.isArray(body.businessSubcategoryIds)
      ? body.businessSubcategoryIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '').map((id: string) => id.trim())
      : []
    if (ids.length > 0) {
      tenantSet.businessSubcategories = ids.map((id: string, i: number) => ({ _type: 'reference' as const, _key: `sub-${i}`, _ref: id }))
    } else {
      tenantUnset.push('businessSubcategories')
    }
  }
  if (body.country !== undefined) tenantSet.country = body.country ? String(body.country) : null
  if (body.city !== undefined) tenantSet.city = body.city ? String(body.city) : null
  if (body.deactivated !== undefined) tenantSet.deactivated = Boolean(body.deactivated)
  if (body.deactivateUntil !== undefined) {
    const v = body.deactivateUntil
    tenantSet.deactivateUntil = v === null || v === '' ? null : String(v)
  }
  if (body.defaultLanguage !== undefined) {
    const v = body.defaultLanguage
    tenantSet.defaultLanguage = v === null || v === '' ? null : (v === 'en' ? 'en' : 'ar')
  }
  if (body.supportsDineIn !== undefined) tenantSet.supportsDineIn = Boolean(body.supportsDineIn)
  if (body.supportsReceiveInPerson !== undefined) tenantSet.supportsReceiveInPerson = Boolean(body.supportsReceiveInPerson)
  if (body.supportsDelivery !== undefined) {
    tenantSet.supportsDelivery = Boolean(body.supportsDelivery)
    if (!tenantSet.supportsDelivery) {
      tenantSet.defaultAutoDeliveryRequestMinutes = null
      tenantSet.saveAutoDeliveryRequestPreference = false
    }
  }
  if (body.freeDeliveryEnabled !== undefined) tenantSet.freeDeliveryEnabled = Boolean(body.freeDeliveryEnabled)
  if (body.supportsDriverPickup !== undefined) tenantSet.supportsDriverPickup = Boolean(body.supportsDriverPickup)
  if (body.defaultAutoDeliveryRequestMinutes !== undefined && body.supportsDelivery !== false) {
    const raw = body.defaultAutoDeliveryRequestMinutes
    if (raw === null) {
      tenantSet.defaultAutoDeliveryRequestMinutes = null
    } else if (typeof raw === 'number' && [0, 5, 10, 15, 20, 25, 30, 35, 40].includes(raw)) {
      tenantSet.defaultAutoDeliveryRequestMinutes = raw
    }
  }
  if (body.saveAutoDeliveryRequestPreference !== undefined && body.supportsDelivery !== false) {
    tenantSet.saveAutoDeliveryRequestPreference = Boolean(body.saveAutoDeliveryRequestPreference)
  }
  if (body.catalogHidePrices !== undefined) tenantSet.catalogHidePrices = Boolean(body.catalogHidePrices)
  if (body.prioritizeWhatsapp !== undefined) tenantSet.prioritizeWhatsapp = Boolean(body.prioritizeWhatsapp)

  if (body.ownerPhone !== undefined) {
    const { normalizePhoneDigits } = await import('@/lib/order-auth')
    const raw = typeof body.ownerPhone === 'string' ? body.ownerPhone.trim() : ''
    if (raw) {
      let digits = normalizePhoneDigits(raw)
      if (digits.startsWith('0') && digits.length === 10) digits = '972' + digits.slice(1)
      if (digits) {
        tenantSet.ownerPhone = raw
        tenantSet.normalizedOwnerPhone = digits
      }
    } else {
      tenantUnset.push('ownerPhone', 'normalizedOwnerPhone')
    }
  }

  if (body.slugNew !== undefined && typeof body.slugNew === 'string') {
    const newSlug = slugify(body.slugNew.trim() || '')
    if (newSlug && newSlug !== slug) tenantSet.slug = { _type: 'slug' as const, current: newSlug }
  }

  if (body.locationLat !== undefined && body.locationLng !== undefined) {
    if (body.locationLat === null || body.locationLng === null) {
      tenantUnset.push('locationLat', 'locationLng')
    } else {
      tenantSet.locationLat = Number(body.locationLat)
      tenantSet.locationLng = Number(body.locationLng)
    }
  }

  // Build restaurantInfo patch
  const restFields = {
    name_en: body.name_en,
    name_ar: body.name_ar,
    tagline_en: body.tagline_en,
    tagline_ar: body.tagline_ar,
    address_en: body.address_en,
    address_ar: body.address_ar,
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
          shifts: Array.isArray(d?.shifts) ? d.shifts.map((s, j) => ({ _key: `shift-${j}`, _type: 'object', open: s.open ?? '', close: s.close ?? '' })) : []
        }))
      : []
  }
  if (restFields.customDateHours !== undefined) {
    restPatch.customDateHours = Array.isArray(restFields.customDateHours)
      ? restFields.customDateHours.filter((d: CustomDateHours) => d?.date).map((d: CustomDateHours, i: number) => ({
          _key: `custom-${i}-${d.date ?? ''}`,
          _type: 'object',
          date: d.date ?? '',
          open: d?.open ?? '',
          close: d?.close ?? '',
          shifts: Array.isArray(d?.shifts) ? d.shifts.map((s, j) => ({ _key: `shift-${j}`, _type: 'object', open: s.open ?? '', close: s.close ?? '' })) : []
        }))
      : []
  }

  const hasRestFields = Object.keys(restPatch).length > 0

  if (hasRestFields && restPatch.logo) {
    tenantSet.businessLogo = restPatch.logo
  }

  if (hasRestFields && !existingRest) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    tenantSet.businessCreatedAt = now.toISOString()
    tenantSet.subscriptionExpiresAt = expiresAt.toISOString()
    tenantSet.subscriptionStatus = 'trial'
    tenantSet.subscriptionPlan = 'ultra'
  }

  // Execute: 1 tenant commit + 1 restaurantInfo commit (batched)
  const tenantPatch = writeClient.patch(auth.tenantId)
  if (Object.keys(tenantSet).length > 0) tenantPatch.set(tenantSet)
  if (tenantUnset.length > 0) tenantPatch.unset(tenantUnset)

  const ops: Promise<unknown>[] = []
  if (Object.keys(tenantSet).length > 0 || tenantUnset.length > 0) {
    ops.push(tenantPatch.commit())
  }

  if (hasRestFields) {
    if (existingRest) {
      ops.push(writeClient.patch(existingRest._id).set(restPatch).commit())
    } else {
      ops.push(
        writeClient.create({
          _type: 'restaurantInfo',
          site: { _type: 'reference' as const, _ref: auth.tenantId },
          name_en: (body.name_en != null && body.name_en !== '') ? String(body.name_en) : 'Store',
          name_ar: (body.name_ar != null && body.name_ar !== '') ? String(body.name_ar) : 'متجر',
          ...restPatch,
        })
      )
    }
  }

  await Promise.all(ops)

  return NextResponse.json(slugRedirectTo ? { ok: true, redirectTo: slugRedirectTo } : { ok: true })
}
