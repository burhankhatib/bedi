/**
 * Helper to fetch business hours and open status for AI search context.
 */
import { client } from '@/sanity/lib/client'
import {
  getTodaysHours,
  isWithinHours,
  getTimeZoneForCountry,
  type DayHours,
} from '@/lib/business-hours'

const CITY_TENANT_FILTER = `(city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))`

type TenantRow = {
  _id: string
  name: string
  slug: string
  businessType: string
  country?: string | null
  restaurantInfo?: {
    openingHours?: DayHours[]
    customDateHours?: Array<{ date?: string; open?: string; close?: string; shifts?: { open?: string; close?: string }[] }>
  } | null
}

export type BusinessHoursInfo = {
  _id: string
  name: string
  slug: string
  businessType: string
  isOpenNow: boolean
  todayHours: string
  fullWeekHours?: string
}

function formatHours(day: DayHours | null): string {
  if (!day) return 'Closed'
  if (day.shifts && day.shifts.length > 0) {
    return day.shifts
      .filter((s) => s.open || s.close)
      .map((s) => `${s.open ?? '?'}–${s.close ?? '?'}`)
      .join(', ')
  }
  if (day.open && day.close) return `${day.open}–${day.close}`
  if (day.open) return `Opens ${day.open}`
  if (day.close) return `Closes ${day.close}`
  return 'Closed'
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatFullWeek(openingHours: DayHours[] | null): string {
  if (!openingHours || openingHours.length < 7) return ''
  return openingHours
    .map((day, i) => `${DAY_LABELS[i]}: ${formatHours(day)}`)
    .join(' | ')
}

/** Fetch all businesses in city with hours and compute open status. */
export async function getBusinessHoursForCity(
  city: string,
  country?: string
): Promise<BusinessHoursInfo[]> {
  const countryFilter = country ? '&& (country == $country || lower(country) == lower($country))' : ''
  const tenants = await client.fetch<TenantRow[]>(
    `*[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}] | order(name asc) [0...50] {
      _id, name, "slug": slug.current, businessType, country,
      "restaurantInfo": *[_type == "restaurantInfo" && site._ref == ^._id][0] {
        openingHours,
        customDateHours
      }
    }`,
    { city, ...(country ? { country } : {}) }
  )

  const result: BusinessHoursInfo[] = []
  for (const t of tenants ?? []) {
    const ri = t.restaurantInfo
    const openingHours = ri?.openingHours ?? null
    const customDateHours = ri?.customDateHours ?? null
    const tz = getTimeZoneForCountry(t.country ?? country ?? null)
    const todaysHours = getTodaysHours(openingHours, customDateHours, tz)
    const isOpenNow = isWithinHours(todaysHours, tz)
    const todayHours = formatHours(todaysHours)
    const fullWeekHours = formatFullWeek(openingHours)

    result.push({
      _id: t._id,
      name: t.name ?? '',
      slug: typeof t.slug === 'string' ? t.slug : (t.slug as { current?: string })?.current ?? '',
      businessType: t.businessType ?? 'restaurant',
      isOpenNow,
      todayHours,
      fullWeekHours: fullWeekHours || undefined,
    })
  }
  return result
}

/** Get hours for a specific business by name or slug. Returns detailed status. */
export async function getBusinessHoursByName(
  city: string,
  businessNameOrSlug: string,
  country?: string
): Promise<{
  found: boolean
  name?: string
  slug?: string
  isOpenNow?: boolean
  todayHours?: string
  fullWeekHours?: string
  closedMessage?: string
}> {
  const q = businessNameOrSlug.trim().toLowerCase()
  const all = await getBusinessHoursForCity(city, country)
  const match = all.find(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q) ||
      q.includes(b.name.toLowerCase()) ||
      q.includes(b.slug.toLowerCase())
  )
  if (!match) return { found: false }

  const tenant = await client.fetch<{ country?: string; restaurantInfo?: { openingHours?: DayHours[]; customDateHours?: Array<{ date?: string; open?: string; close?: string; shifts?: unknown[] }> } } | null>(
    `*[_type == "tenant" && _id == $id][0] {
      country,
      "restaurantInfo": *[_type == "restaurantInfo" && site._ref == ^._id][0] { openingHours, customDateHours }
    }`,
    { id: match._id }
  )
  const ri = tenant?.restaurantInfo
  const openingHours = ri?.openingHours ?? null
  const customDateHours = (ri?.customDateHours ?? null) as Parameters<typeof getTodaysHours>[1]
  const tz = getTimeZoneForCountry(tenant?.country ?? country ?? null)
  const todaysHours = getTodaysHours(openingHours, customDateHours, tz)
  const isOpen = isWithinHours(todaysHours, tz)

  return {
    found: true,
    name: match.name,
    slug: match.slug,
    isOpenNow: isOpen,
    todayHours: formatHours(todaysHours),
    fullWeekHours: match.fullWeekHours,
  }
}
