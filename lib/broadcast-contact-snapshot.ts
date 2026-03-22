import { client } from '@/sanity/lib/client'

/** Stored in Firestore `broadcastContactCache/snapshot` — built from Sanity only during sync. */
export type BroadcastContactSnapshot = {
  syncedAtMs: number
  tenants: Array<{ name?: string; ownerPhone?: string; country?: string; city?: string }>
  drivers: Array<{
    name?: string
    phoneNumber?: string
    country?: string
    city?: string
    isVerifiedByAdmin?: boolean
  }>
  /** Customers inferred from orders (when geo filters apply) */
  customersFromOrders: Array<{
    customerName?: string
    customerPhone?: string
    country?: string
    city?: string
  }>
  customersDirect: Array<{ name?: string; primaryPhone?: string }>
  /** Preformatted for admin location pickers (same as former broadcast-locations API) */
  locationCountries: string[]
  locationCities: string[]
}

export async function fetchBroadcastContactSnapshotFromSanity(): Promise<Omit<BroadcastContactSnapshot, 'syncedAtMs'>> {
  const tenants = await client.fetch<
    Array<{ name?: string; ownerPhone?: string; country?: string; city?: string }>
  >(`*[_type == "tenant" && defined(ownerPhone)] { name, ownerPhone, country, city }`)

  const drivers = await client.fetch<
    Array<{
      name?: string
      phoneNumber?: string
      country?: string
      city?: string
      isVerifiedByAdmin?: boolean
    }>
  >(
    `*[_type == "driver" && isVerifiedByAdmin == true && defined(phoneNumber)] { name, phoneNumber, country, city, isVerifiedByAdmin }`
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

  const customersDirect = await client.fetch<Array<{ name?: string; primaryPhone?: string }>>(
    `*[_type == "customer" && defined(primaryPhone)] { name, primaryPhone }`
  )

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
): Array<{ phone: string; name: string }> {
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

  const recipientsMap = new Map<string, string>()

  const matchLocation = (docCountry?: string, docCity?: string) => {
    const cCode = (docCountry || '').trim().toLowerCase()
    const cName = (docCity || '').trim().toLowerCase()
    const countryMatch = countries.length === 0 || countries.includes(cCode)
    const cityMatch = cities.length === 0 || cities.includes(cName)
    return countryMatch && cityMatch
  }

  if (targets?.includes('businesses')) {
    for (const t of snap.tenants) {
      if (matchLocation(t.country, t.city) && t.ownerPhone) {
        recipientsMap.set(t.ownerPhone, t.name || 'صاحب العمل')
      }
    }
  }

  if (targets?.includes('drivers')) {
    for (const d of snap.drivers) {
      if (matchLocation(d.country, d.city) && d.phoneNumber && d.isVerifiedByAdmin) {
        recipientsMap.set(d.phoneNumber, d.name || 'كابتن')
      }
    }
  }

  if (targets?.includes('customers')) {
    if (countries.length > 0 || cities.length > 0) {
      for (const o of snap.customersFromOrders) {
        if (matchLocation(o.country, o.city) && o.customerPhone) {
          if (!recipientsMap.has(o.customerPhone)) {
            recipientsMap.set(o.customerPhone, o.customerName || 'عميلنا العزيز')
          }
        }
      }
    } else {
      for (const c of snap.customersDirect) {
        if (c.primaryPhone && !recipientsMap.has(c.primaryPhone)) {
          recipientsMap.set(c.primaryPhone, c.name || 'عميلنا العزيز')
        }
      }
    }
  }

  if (specificUsers && Array.isArray(specificUsers)) {
    for (const u of specificUsers) {
      if (u.phone && u.name) {
        recipientsMap.set(u.phone, u.name)
      }
    }
  }

  return Array.from(recipientsMap.entries()).map(([phone, name]) => ({ phone, name }))
}
