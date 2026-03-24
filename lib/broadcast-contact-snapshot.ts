import { client } from '@/sanity/lib/client'

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

  const fcmSubscriptions = await client.fetch<Array<{ clerkUserId?: string }>>(
    `*[_type == "userPushSubscription" && isActive != false && defined(devices[].fcmToken)] { clerkUserId }`
  )
  const fcmUsers = Array.from(new Set(fcmSubscriptions.map(s => s.clerkUserId).filter(Boolean) as string[]))

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

/** Same matching rules as the original broadcast-whatsapp route, using cached snapshot rows. */
export function resolveRecipientsFromSnapshot(
  snap: Omit<BroadcastContactSnapshot, 'syncedAtMs'>,
  input: ResolveRecipientsInput
): Array<{ phone: string; name: string; clerkUserId?: string; role: 'business' | 'driver' | 'customer' | 'specific'; hasFcm: boolean }> {
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

  const recipientsMap = new Map<string, { name: string; clerkUserId?: string; role: 'business' | 'driver' | 'customer' | 'specific'; hasFcm: boolean }>()

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

  if (targets?.includes('businesses')) {
    for (const t of snap.tenants) {
      if (matchLocation(t.country, t.city) && t.ownerPhone) {
        recipientsMap.set(t.ownerPhone, { name: t.name || 'صاحب العمل', clerkUserId: t.clerkUserId, role: 'business', hasFcm: checkFcm(t.clerkUserId) })
      }
    }
  }

  if (targets?.includes('drivers')) {
    for (const d of snap.drivers) {
      if (matchLocation(d.country, d.city) && d.phoneNumber && d.isVerifiedByAdmin) {
        recipientsMap.set(d.phoneNumber, { name: d.name || 'كابتن', clerkUserId: d.clerkUserId, role: 'driver', hasFcm: checkFcm(d.clerkUserId) })
      }
    }
  }

  if (targets?.includes('customers')) {
    if (countries.length > 0 || cities.length > 0) {
      for (const o of snap.customersFromOrders) {
        if (matchLocation(o.country, o.city) && o.customerPhone) {
          if (!recipientsMap.has(o.customerPhone)) {
            // Customer from orders doesn't have clerkUserId directly here, so hasFcm might be false unless fetched differently
            recipientsMap.set(o.customerPhone, { name: o.customerName || 'عميلنا العزيز', role: 'customer', hasFcm: false })
          }
        }
      }
    } else {
      for (const c of snap.customersDirect) {
        if (c.primaryPhone && !recipientsMap.has(c.primaryPhone)) {
          recipientsMap.set(c.primaryPhone, { name: c.name || 'عميلنا العزيز', clerkUserId: c.clerkUserId, role: 'customer', hasFcm: checkFcm(c.clerkUserId) })
        }
      }
    }
  }

  if (specificUsers && Array.isArray(specificUsers)) {
    for (const u of specificUsers) {
      if (u.phone && u.name) {
        // Find existing to preserve FCM info if any
        const existing = recipientsMap.get(u.phone)
        recipientsMap.set(u.phone, { name: u.name, role: 'specific', clerkUserId: existing?.clerkUserId, hasFcm: existing?.hasFcm || false })
      }
    }
  }

  return Array.from(recipientsMap.entries()).map(([phone, data]) => ({ 
    phone, 
    name: data.name,
    clerkUserId: data.clerkUserId,
    role: data.role,
    hasFcm: data.hasFcm
  }))
}
