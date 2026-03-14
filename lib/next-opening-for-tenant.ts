/**
 * Compute the next opening datetime for a tenant (by slug).
 * Used when product is marked unavailable with "until next opening".
 */
import { client } from '@/sanity/lib/client'
import { getNextOpening, getTodaysHours, getTimeZoneForCountry } from '@/lib/business-hours'
import type { DayHours } from '@/lib/business-hours'

export async function getNextOpeningForTenant(slug: string): Promise<string | null> {
  const tenant = await client.fetch<{
    country?: string
    restaurantInfo?: {
      openingHours?: DayHours[]
      customDateHours?: Array<{ date?: string; open?: string; close?: string; shifts?: { open?: string; close?: string }[] }>
    }
  } | null>(
    `*[_type == "tenant" && slug.current == $slug][0] {
      country,
      "restaurantInfo": *[_type == "restaurantInfo" && site._ref == ^._id][0] { openingHours, customDateHours }
    }`,
    { slug }
  )

  if (!tenant) return null

  const openingHours = tenant.restaurantInfo?.openingHours ?? null
  const customDateHours = tenant.restaurantInfo?.customDateHours ?? null
  const timeZone = getTimeZoneForCountry(tenant.country)
  const todaysHours = getTodaysHours(openingHours, customDateHours, timeZone)

  const result = getNextOpening(false, null, todaysHours, openingHours, 'en', timeZone)
  return result.nextOpenAt?.toISOString() ?? null
}
