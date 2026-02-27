import { client } from '@/sanity/lib/client'

const CACHE_TTL_MS = 60_000 // 60 seconds
let cachedStats: { data: HomePageStats; expires: number } | null = null

export type HomePageStats = {
  businesses: number
  productsSold: number
  drivers: number
  cities: number
  countries: number
  orders: number
}

/** Fetches aggregate stats for the homepage (businesses, products sold, drivers, cities, countries, orders). Cached 60s. */
export async function getHomePageStats(): Promise<HomePageStats> {
  const now = Date.now()
  if (cachedStats && cachedStats.expires > now) return cachedStats.data

  const [
    businesses,
    ordersCount,
    ordersWithQuantities,
    drivers,
    tenantLocations,
  ] = await Promise.all([
    client.fetch<number>(`count(*[_type == "tenant"])`),
    client.fetch<number>(`count(*[_type == "order"])`),
    client.fetch<{ quantities: (number | null)[] }[]>(
      `*[_type == "order"]{ "quantities": items[].quantity }`
    ),
    client.fetch<number>(`count(*[_type == "driver"])`),
    client.fetch<{ country: string | null; city: string | null }[]>(
      `*[_type == "tenant" && defined(country) && country != ""]{ country, city }`
    ),
  ])

  const productsSold = Array.isArray(ordersWithQuantities)
    ? ordersWithQuantities.flatMap((o) => o.quantities ?? []).reduce((sum: number, q) => sum + (q ?? 0), 0)
    : 0

  const countrySet = new Set<string>()
  const cityKeySet = new Set<string>()
  for (const t of tenantLocations ?? []) {
    if (t?.country) countrySet.add(t.country)
    const city = (t?.city ?? '').trim()
    if (city) cityKeySet.add(`${t?.country ?? ''}|${city}`)
  }

  const data: HomePageStats = {
    businesses: businesses ?? 0,
    productsSold: productsSold ?? 0,
    drivers: drivers ?? 0,
    cities: cityKeySet.size,
    countries: countrySet.size,
    orders: ordersCount ?? 0,
  }
  cachedStats = { data, expires: now + CACHE_TTL_MS }
  return data
}
