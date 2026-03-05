import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { urlFor } from '@/sanity/lib/image'
import { normalizePhone } from '@/lib/driver-utils'
import { isAllowedRegistrationCountry } from '@/lib/constants'
import { getPlatformUser } from '@/lib/platform-user'
import { sendAdminNotification } from '@/lib/admin-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function upsertPlatformUserDriver(userId: string) {
  try {
    const tenants = await client.fetch<{ _id: string }[]>(
      `*[_type == "tenant" && clerkUserId == $userId]{ _id }`,
      { userId }
    )
    const hasTenants = tenants.length > 0
    // Tenant accounts cannot be driver accounts: only set accountType 'driver' when no tenants
    const accountType = hasTenants ? 'tenant' : 'driver'
    const existing = await getPlatformUser(userId)
    if (existing) {
      await writeClient.patch(existing._id).set({ isDriver: true, accountType }).commit()
    } else {
      await writeClient.create({
        _type: 'platformUser',
        clerkUserId: userId,
        accountType,
        isTenant: hasTenants,
        isDriver: true,
      })
    }
  } catch (e) {
    console.warn('[API] platformUser upsert:', e)
  }
}

/** GET current user's driver profile (by clerkUserId) */
export async function GET() {
  let userId: string | null = null
  try {
    const result = await auth()
    userId = result?.userId ?? null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const doc = await client.fetch<{
    _id: string
    name: string
    nickname?: string
    age?: number
    picture?: { _type: string; asset?: { _ref: string } }
    gender?: string
    phoneNumber: string
    vehicleType?: string
    vehicleNumber?: string
    country?: string
    city?: string
    rulesAcknowledged?: boolean
    blockedBySuperAdmin?: boolean
    referralCode?: string
    recommendedBy?: { name: string; phoneNumber: string }
    recommendedDrivers?: Array<{ name: string; phoneNumber: string; createdAt: string }>
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{
      _id, name, nickname, age, picture, gender, phoneNumber, vehicleType, vehicleNumber, country, city, rulesAcknowledged, blockedBySuperAdmin, referralCode,
      "recommendedBy": recommendedBy->{name, phoneNumber},
      "recommendedDrivers": *[_type == "driver" && recommendedBy._ref == ^._id]{ name, phoneNumber, "createdAt": _createdAt }
    }`,
    { userId }
  )
  if (!doc) return NextResponse.json(null)
  if (doc.blockedBySuperAdmin) {
    return NextResponse.json({ error: 'Your driver account has been suspended. Contact support.' }, { status: 403 })
  }

  // Sync with Clerk verified phone
  try {
    const clientClerk = await clerkClient()
    const user = await clientClerk.users.getUser(userId)
    const primaryPhoneId = user.primaryPhoneNumberId
    const primaryPhone = user.phoneNumbers.find(p => p.id === primaryPhoneId)
    if (primaryPhone && primaryPhone.verification?.status === 'verified') {
      let clerkPhone = primaryPhone.phoneNumber
      if (clerkPhone.startsWith('+')) {
        clerkPhone = clerkPhone.substring(1)
      }
      const sanityPhoneNorm = normalizePhone(doc.phoneNumber || '')
      const clerkPhoneNorm = normalizePhone(clerkPhone)
      if (clerkPhoneNorm && sanityPhoneNorm !== clerkPhoneNorm) {
        await writeClient.patch(doc._id).set({ phoneNumber: clerkPhone, normalizedPhone: clerkPhoneNorm }).commit()
        doc.phoneNumber = clerkPhone // update returned doc
      }
    }
  } catch (e) {
    console.error('[API] Sync driver phone error:', e)
  }

  const pictureUrl = doc.picture ? urlFor(doc.picture).width(200).height(200).url() : null
  return NextResponse.json({
    ...doc,
    pictureUrl,
  })
}

function readBody(body: Record<string, unknown>) {
  const name = body.name != null ? String(body.name).trim() : ''
  const phoneNumber = body.phoneNumber != null ? String(body.phoneNumber).replace(/\s/g, '') : ''
  const country = body.country != null ? String(body.country).trim() : undefined
  const city = body.city != null ? String(body.city).trim() : undefined
  const vehicleType = body.vehicleType != null ? String(body.vehicleType) : undefined
  const nickname = body.nickname != null ? String(body.nickname).trim() || undefined : undefined
  const age = body.age != null ? (typeof body.age === 'number' ? body.age : parseInt(String(body.age), 10)) : undefined
  const pictureAssetId = body.pictureAssetId != null && body.pictureAssetId !== '' ? String(body.pictureAssetId) : undefined
  const gender = body.gender != null ? String(body.gender) : undefined
  const vehicleNumber = body.vehicleNumber != null ? String(body.vehicleNumber).trim() || undefined : undefined
  const rulesAcknowledged = body.rulesAcknowledged === true
  const recommendedByCode = body.recommendedByCode != null ? String(body.recommendedByCode).trim() : undefined
  return {
    name,
    phoneNumber,
    country,
    city,
    vehicleType,
    nickname,
    age: age != null && !Number.isNaN(age) ? age : undefined,
    pictureAssetId,
    gender,
    vehicleNumber,
    rulesAcknowledged,
    recommendedByCode,
  }
}

/** PATCH or create driver profile. When phone matches a tenant-added placeholder (no clerkUserId), driver "takes control" of that profile. New registrations require rulesAcknowledged. */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver?._id) {
    return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  }

  try {
    // 1. Find or create "Default Driver"
    let defaultDriver = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "driver" && name == "Default Driver"][0]{ _id }`
    )
    if (!defaultDriver) {
      defaultDriver = await writeClient.create({
        _type: 'driver',
        name: 'Default Driver',
        phoneNumber: '0000000000',
        normalizedPhone: '0000000000',
        isActive: false,
        rulesAcknowledged: true,
      })
    }

    // 2. Reassign all orders to Default Driver
    const orderIds = await writeClient.fetch<string[]>(
      `*[_type == "order" && assignedDriver._ref == $driverId]._id`,
      { driverId: driver._id }
    )

    for (const orderId of orderIds) {
      try {
        await writeClient
          .patch(orderId)
          .set({
            assignedDriver: { _type: 'reference', _ref: defaultDriver._id },
          })
          .commit()
      } catch (e) {
        console.warn(`[Driver Delete] Failed to patch order ${orderId}:`, e)
      }
    }

    // 3. Delete driver profile
    await writeClient.delete(driver._id)

    // 4. Update platformUser to remove isDriver status
    const existing = await getPlatformUser(userId)
    if (existing) {
      await writeClient.patch(existing._id).set({ isDriver: false }).commit()
    }

    return NextResponse.json({ success: true, message: 'Profile deleted permanently.' })
  } catch (err) {
    console.error('[Driver Delete] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** PATCH or create driver profile. When phone matches a tenant-added placeholder (no clerkUserId), driver "takes control" of that profile. New registrations require rulesAcknowledged. */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const {
    name,
    phoneNumber,
    country,
    city,
    vehicleType,
    nickname,
    age,
    pictureAssetId,
    gender,
    vehicleNumber,
    rulesAcknowledged,
    recommendedByCode,
  } = readBody(body)

  if (!name || !phoneNumber) return NextResponse.json({ error: 'name and phoneNumber required' }, { status: 400 })
  if (country && !isAllowedRegistrationCountry(country)) {
    return NextResponse.json(
      { error: 'Registration is currently only available for Israel and Palestine. More countries will be added later.' },
      { status: 400 }
    )
  }
  const normalized = normalizePhone(phoneNumber)
  if (!normalized) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })

  const existingByClerk = await client.fetch<{ _id: string; referralCode?: string; recommendedBy?: any } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, referralCode, recommendedBy }`,
    { userId }
  )
  
  let recommendedByRef: { _type: 'reference', _ref: string } | undefined
  if (recommendedByCode) {
    const referrer = await client.fetch<{ _id: string } | null>(
      `*[_type == "driver" && referralCode == $code][0]{ _id }`,
      { code: recommendedByCode }
    )
    if (referrer) {
      recommendedByRef = { _type: 'reference', _ref: referrer._id }
    }
  }

  if (existingByClerk?._id) {
    const samePhoneOther = await client.fetch<{ _id: string } | null>(
      `*[_type == "driver" && normalizedPhone == $normalized && clerkUserId != $userId && defined(clerkUserId)][0]{ _id }`,
      { normalized, userId }
    )
    if (samePhoneOther) return NextResponse.json({ error: 'This phone number is already registered by another driver.' }, { status: 409 })
    const set: Record<string, unknown> = {
      name,
      phoneNumber,
      normalizedPhone: normalized,
      country: country ?? undefined,
      city: city ?? undefined,
      vehicleType: vehicleType || undefined,
      nickname,
      age,
      gender,
      vehicleNumber,
    }
    if (!existingByClerk.referralCode) {
      set.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    }
    // Only set recommendedBy if not already set
    if (!existingByClerk.recommendedBy && recommendedByRef) {
      set.recommendedBy = recommendedByRef
    }
    if (pictureAssetId) set.picture = { _type: 'image', asset: { _type: 'reference', _ref: pictureAssetId } }
    await writeClient.patch(existingByClerk._id).set(set).commit()
    await upsertPlatformUserDriver(userId)
    const updated = await client.fetch(
      `*[_type == "driver" && _id == $id][0]{ _id, name, nickname, age, picture, gender, phoneNumber, vehicleType, vehicleNumber, country, city, referralCode, recommendedBy }`,
      { id: existingByClerk._id }
    )
    return NextResponse.json(updated)
  }

  let placeholderByPhone = await client.fetch<{ _id: string; clerkUserId?: string; referralCode?: string; recommendedBy?: any } | null>(
    `*[_type == "driver" && normalizedPhone == $normalized][0]{ _id, clerkUserId, referralCode, recommendedBy }`,
    { normalized }
  )
  if (!placeholderByPhone?._id) {
    const placeholdersNoField = await client.fetch<Array<{ _id: string; phoneNumber?: string; clerkUserId?: string; referralCode?: string; recommendedBy?: any }>>(
      `*[_type == "driver" && !defined(clerkUserId)]{ _id, phoneNumber, clerkUserId, referralCode, recommendedBy }`
    )
    const match = placeholdersNoField?.find((d) => normalizePhone(d.phoneNumber || '') === normalized)
    if (match) placeholderByPhone = { _id: match._id, clerkUserId: match.clerkUserId, referralCode: match.referralCode, recommendedBy: match.recommendedBy }
  }
  if (placeholderByPhone?._id) {
    if (placeholderByPhone.clerkUserId && placeholderByPhone.clerkUserId !== userId) {
      return NextResponse.json({ error: 'This phone number is already registered by another driver.' }, { status: 409 })
    }
    const set: Record<string, unknown> = {
      clerkUserId: userId,
      name,
      phoneNumber,
      normalizedPhone: normalized,
      country: country ?? undefined,
      city: city ?? undefined,
      vehicleType: vehicleType || undefined,
      nickname,
      age,
      gender,
      vehicleNumber,
      rulesAcknowledged: true,
    }
    if (!placeholderByPhone.referralCode) {
      set.referralCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    }
    if (!placeholderByPhone.recommendedBy && recommendedByRef) {
      set.recommendedBy = recommendedByRef
    }
    if (pictureAssetId) set.picture = { _type: 'image', asset: { _type: 'reference', _ref: pictureAssetId } }
    await writeClient.patch(placeholderByPhone._id).set(set).commit()
    await upsertPlatformUserDriver(userId)
    const taken = await client.fetch(
      `*[_type == "driver" && _id == $id][0]{ _id, name, nickname, age, picture, gender, phoneNumber, vehicleType, vehicleNumber, country, city, referralCode, recommendedBy }`,
      { id: placeholderByPhone._id }
    )
    
    // Notify Super Admin only (FCM / Web Push) — no tenant or other admins receive this
    await sendAdminNotification(
      'New Driver Pending Verification',
      `${name} has claimed a driver profile and is waiting to be verified.`,
      '/admin/reports'
    )
    
    return NextResponse.json({ ...taken, claimedPlaceholder: true })
  }

  if (!rulesAcknowledged) {
    return NextResponse.json(
      { error: 'You must acknowledge the rules and rights of the website to register as a driver.' },
      { status: 400 }
    )
  }
  const createPayload = {
    _type: 'driver' as const,
    clerkUserId: userId,
    name,
    phoneNumber,
    normalizedPhone: normalized,
    country: country ?? '',
    city: city ?? '',
    isActive: true,
    rulesAcknowledged: true,
    referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
    ...(recommendedByRef && { recommendedBy: recommendedByRef }),
    ...(vehicleType && { vehicleType }),
    ...(nickname && { nickname }),
    ...(age != null && { age }),
    ...(gender && { gender }),
    ...(vehicleNumber && { vehicleNumber }),
    ...(pictureAssetId && {
      picture: { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: pictureAssetId } },
    }),
  }
  const created = await writeClient.create(createPayload)
  await upsertPlatformUserDriver(userId)
  
  // Notify Super Admin only (FCM / Web Push) — no tenant or other admins receive this
  await sendAdminNotification(
    'New Driver Pending Verification',
    `${name} has registered as a driver and is waiting to be verified.`,
    '/admin/reports'
  )

  return NextResponse.json(created)
}
