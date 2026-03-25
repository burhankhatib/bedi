import { client } from '@/sanity/lib/client'
import { canonicalWhatsAppInboxPhone } from '@/lib/whatsapp-inbox-phone'

/** Stored in Firestore `broadcastContactCache/snapshot` — built from Sanity only during sync. */
export type BroadcastContactSnapshot = {
  syncedAtMs: number
  tenants: Array<{ name?: string; ownerPhone?: string; country?: string; city?: string; clerkUserId?: string }>
  drivers: Array<{
    name?: string
    phoneNumber?: string
    country?: string
    city?: string
    isVerifiedByAdmin?: boolean
    clerkUserId?: string
  }>
  /** Customers inferred from orders (when geo filters apply) */
  customersFromOrders: Array<{
    customerName?: string
    customerPhone?: string
    country?: string
    city?: string
  }>
  customersDirect: Array<{ name?: string; primaryPhone?: string; clerkUserId?: string }>
  /** Array of clerkUserIds that have active FCM tokens */
  fcmUsers: string[]
  /** Preformatted for admin location pickers (same as former broadcast-locations API) */
  locationCountries: string[]
  locationCities: string[]
}

export async function fetchBroadcastContactSnapshotFromSanity(): Promise<Omit<BroadcastContactSnapshot, 'syncedAtMs'>> {
  const tenants = await client.fetch<
    Array<{ name?: string; ownerPhone?: string; country?: string; city?: string; clerkUserId?: string }>
  >(`*[_type == "tenant" && defined(ownerPhone)] { name, ownerPhone, country, city, clerkUserId }`)

  const drivers = await client.fetch<
    Array<{
      name?: string
      phoneNumber?: string
      country?: string
      city?: string
      isVerifiedByAdmin?: boolean
      clerkUserId?: string
    }>
  >(
    `*[_type == "driver" && isVerifiedByAdmin == true && defined(phoneNumber)] { name, phoneNumber, country, city, isVerifiedByAdmin, clerkUserId }`
  )

  const customersFromOrders = await client.fetch<
    Array<{
      customerName?: string
      customerPhone?: string
      country?: string
      city?: string
    }>
  >(
    `*[_type == "order" && defined(customerPhone)] { 
      customerName, 
      customerPhone, 
      "country": site->country, 
      "city": site->city 
    }`
  )

  const customersDirect = await client.fetch<Array<{ name?: string; primaryPhone?: string; clerkUserId?: string }>>(
    `*[_type == "customer" && defined(primaryPhone)] { name, primaryPhone, clerkUserId }`
  )

  /** Central subscriptions: detect FCM in JS — GROQ `defined(devices[].fcmToken)` is unreliable on array projections. */
  const pushSubs = await client.fetch<
    Array<{ clerkUserId?: string; fcmToken?: string; devices?: Array<{ fcmToken?: string | null }> }>
  >(`*[_type == "userPushSubscription" && isActive != false]{ clerkUserId, fcmToken, devices }`)

  const docHasFcm = (s: (typeof pushSubs)[0]): boolean => {
    if ((s.fcmToken ?? '').trim().length > 0) return true
    if (!Array.isArray(s.devices)) return false
    return s.devices.some((d) => (d?.fcmToken ?? '').trim().length > 0)
  }

  const fcmUserSet = new Set<string>()
  for (const s of pushSubs) {
    const id = (s.clerkUserId ?? '').trim()
    if (id && docHasFcm(s)) fcmUserSet.add(id)
  }

  /** Legacy FCM on tenant documents (tenant-and-staff-push still sends here before central subs). */
  const tenantsLegacyFcm = await client.fetch<Array<{ clerkUserId?: string; fcmToken?: string; fcmTokens?: string[] }>>(
    `*[_type == "tenant" && defined(clerkUserId)]{ clerkUserId, fcmToken, fcmTokens }`
  )
  for (const t of tenantsLegacyFcm) {
    const id = (t.clerkUserId ?? '').trim()
    if (!id) continue
    const single = (t.fcmToken ?? '').trim().length > 0
    const multi =
      Array.isArray(t.fcmTokens) && t.fcmTokens.some((tok) => (tok ?? '').trim().length > 0)
    if (single || multi) fcmUserSet.add(id)
  }

  /** Legacy driver FCM on driver document (used when central sub missing). */
  const driversLegacyFcm = await client.fetch<Array<{ clerkUserId?: string; fcmToken?: string }>>(
    `*[_type == "driver" && isVerifiedByAdmin == true && defined(clerkUserId)]{ clerkUserId, fcmToken }`
  )
  for (const d of driversLegacyFcm) {
    const id = (d.clerkUserId ?? '').trim()
    if (id && (d.fcmToken ?? '').trim().length > 0) fcmUserSet.add(id)
  }

  const fcmUsers = Array.from(fcmUserSet)

  const tenantsForLocations = await client.fetch<Array<{ country?: string; city?: string }>>(
    `*[_type == "tenant" && defined(country) && defined(city)] { country, city }`
  )

  const rawCountries = Array.from(
    new Set(tenantsForLocations.map((t) => t.country?.trim().toLowerCase()).filter(Boolean) as string[])
  )
  const rawCities = Array.from(
    new Set(tenantsForLocations.map((t) => t.city?.trim().toLowerCase()).filter(Boolean) as string[])
  )

  const formatProper = (s: string) => {
    if (s.length <= 2) return s.toUpperCase()
    return s
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return {
    tenants,
    drivers,
    customersFromOrders,
    customersDirect,
    fcmUsers,
    locationCountries: rawCountries.map((c) => formatProper(c)),
    locationCities: rawCities.map((c) => formatProper(c)),
  }
}

export type ResolveRecipientsInput = {
  targets: string[]
  country?: string
  city?: string
  specificUsers?: Array<{ phone?: string; name?: string }>
}

/** Resolved row for broadcast jobs, preview, and delivery logging (country/city from CMS when available). */
export type BroadcastResolvedRecipient = {
  phone: string
  name: string
  clerkUserId?: string
  role: 'business' | 'driver' | 'customer' | 'specific'
  hasFcm: boolean
  country?: string
  city?: string
}

/** Same matching rules as the original broadcast-whatsapp route, using cached snapshot rows. */
export function resolveRecipientsFromSnapshot(
  snap: Omit<BroadcastContactSnapshot, 'syncedAtMs'>,
  input: ResolveRecipientsInput
): BroadcastResolvedRecipient[] {
  const { targets, country, city, specificUsers } = input
  const countries = country
    ? country
        .split(',')
        .map((c: string) => c.trim().toLowerCase())
        .filter(Boolean)
    : []
  const cities = city
    ? city
        .split(',')
        .map((c: string) => c.trim().toLowerCase())
        .filter(Boolean)
    : []

  const recipientsMap = new Map<
    string,
    {
      name: string
      clerkUserId?: string
      role: 'business' | 'driver' | 'customer' | 'specific'
      hasFcm: boolean
      country?: string
      city?: string
    }
  >()

  const matchLocation = (docCountry?: string, docCity?: string) => {
    const cCode = (docCountry || '').trim().toLowerCase()
    const cName = (docCity || '').trim().toLowerCase()
    const countryMatch = countries.length === 0 || countries.includes(cCode)
    const cityMatch = cities.length === 0 || cities.includes(cName)
    return countryMatch && cityMatch
  }

  const checkFcm = (clerkUserId?: string) => {
    if (!clerkUserId) return false
    return Array.isArray(snap.fcmUsers) && snap.fcmUsers.includes(clerkUserId)
  }

  /** Canonical phone digits -> best-known clerkUserId + FCM flag (for manual specific numbers). */
  const phoneKey = (p: string) => canonicalWhatsAppInboxPhone(p)
  const phoneToIdentity = new Map<string, { clerkUserId?: string; hasFcm: boolean }>()
  const mergePhone = (phone: string | undefined, clerkUserId?: string) => {
    const k = phoneKey(phone ?? '')
    if (!k) return
    const hasFcm = checkFcm(clerkUserId)
    const prev = phoneToIdentity.get(k)
    if (!prev) {
      phoneToIdentity.set(k, { clerkUserId, hasFcm })
      return
    }
    const nextHasFcm = prev.hasFcm || hasFcm
    const nextId = prev.clerkUserId || clerkUserId
    phoneToIdentity.set(k, { clerkUserId: nextId, hasFcm: nextHasFcm })
  }
  for (const t of snap.tenants) mergePhone(t.ownerPhone, t.clerkUserId)
  for (const d of snap.drivers) mergePhone(d.phoneNumber, d.clerkUserId)
  for (const c of snap.customersDirect) mergePhone(c.primaryPhone, c.clerkUserId)

  if (targets?.includes('businesses')) {
    for (const t of snap.tenants) {
      if (matchLocation(t.country, t.city) && t.ownerPhone) {
        recipientsMap.set(t.ownerPhone, {
          name: t.name || 'صاحب العمل',
          clerkUserId: t.clerkUserId,
          role: 'business',
          hasFcm: checkFcm(t.clerkUserId),
          country: t.country?.trim() || undefined,
          city: t.city?.trim() || undefined,
        })
      }
    }
  }

  if (targets?.includes('drivers')) {
    for (const d of snap.drivers) {
      if (matchLocation(d.country, d.city) && d.phoneNumber && d.isVerifiedByAdmin) {
        recipientsMap.set(d.phoneNumber, {
          name: d.name || 'كابتن',
          clerkUserId: d.clerkUserId,
          role: 'driver',
          hasFcm: checkFcm(d.clerkUserId),
          country: d.country?.trim() || undefined,
          city: d.city?.trim() || undefined,
        })
      }
    }
  }

  if (targets?.includes('customers')) {
    if (countries.length > 0 || cities.length > 0) {
      for (const o of snap.customersFromOrders) {
        if (matchLocation(o.country, o.city) && o.customerPhone) {
          if (!recipientsMap.has(o.customerPhone)) {
            recipientsMap.set(o.customerPhone, {
              name: o.customerName || 'عميلنا العزيز',
              role: 'customer',
              hasFcm: false,
              country: o.country?.trim() || undefined,
              city: o.city?.trim() || undefined,
            })
          }
        }
      }
    } else {
      for (const c of snap.customersDirect) {
        if (c.primaryPhone && !recipientsMap.has(c.primaryPhone)) {
          recipientsMap.set(c.primaryPhone, {
            name: c.name || 'عميلنا العزيز',
            clerkUserId: c.clerkUserId,
            role: 'customer',
            hasFcm: checkFcm(c.clerkUserId),
          })
        }
      }
    }
  }

  if (specificUsers && Array.isArray(specificUsers)) {
    for (const u of specificUsers) {
      if (u.phone && u.name) {
        const existing = recipientsMap.get(u.phone)
        const fromDigits = phoneToIdentity.get(phoneKey(u.phone))
        const clerkUserId = existing?.clerkUserId ?? fromDigits?.clerkUserId
        const hasFcm = existing?.hasFcm || fromDigits?.hasFcm || checkFcm(clerkUserId)
        recipientsMap.set(u.phone, {
          name: u.name,
          role: 'specific',
          clerkUserId,
          hasFcm,
          country: existing?.country,
          city: existing?.city,
        })
      }
    }
  }

  return Array.from(recipientsMap.entries()).map(([phone, data]) => ({
    phone,
    name: data.name,
    clerkUserId: data.clerkUserId,
    role: data.role,
    hasFcm: data.hasFcm,
    country: data.country,
    city: data.city,
  }))
}
