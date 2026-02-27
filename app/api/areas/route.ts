import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getAreasForCity, areaKey, type AreaSuggestion } from '@/lib/areas-by-city'
import { getTenantIdBySlug } from '@/lib/tenant'

/** Dedupe by name_en (lowercase) + name_ar; normalize whitespace. */
function dedupeByKey(areas: AreaSuggestion[]): AreaSuggestion[] {
  const seen = new Set<string>()
  const out: AreaSuggestion[] = []
  for (const a of areas) {
    const en = (a.name_en ?? '').trim()
    const ar = (a.name_ar ?? '').trim()
    const key = areaKey({ name_en: en, name_ar: ar })
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name_en: en, name_ar: ar })
  }
  return out
}

/**
 * GET suggested delivery areas for a country + city.
 * Priority: (1) Areas used by other businesses in the same city (Sanity). (2) Predefined areas for that city.
 * Case-insensitive match for city/country. Optional slug excludes that tenant's areas. No duplicates.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = (searchParams.get('country') ?? '').trim()
  const city = (searchParams.get('city') ?? '').trim()
  const slug = (searchParams.get('slug') ?? '').trim()

  if (!country || !city) {
    const predefined = getAreasForCity(country, city)
    return NextResponse.json(dedupeByKey(predefined))
  }

  let excludeSiteId: string | null = null
  if (slug) {
    excludeSiteId = await getTenantIdBySlug(slug)
  }

  // Same-city areas from other businesses: case-insensitive match so "Bethany" and "bethany" both match
  type Row = { name_en: string | null; name_ar: string | null }
  const fromSanity = await client.fetch<Row[]>(
    `*[_type == "area" && defined(site->country) && defined(site->city) && lower(site->country) == lower($country) && lower(site->city) == lower($city) && ($excludeSiteId == "" || site._ref != $excludeSiteId)] { name_en, name_ar }`,
    { country, city, excludeSiteId: excludeSiteId ?? '' }
  )

  const community: AreaSuggestion[] = (fromSanity ?? [])
    .filter((r) => r?.name_en != null && r?.name_ar != null)
    .map((r) => ({ name_en: String(r.name_en).trim(), name_ar: String(r.name_ar).trim() }))
    .filter((a) => a.name_en || a.name_ar)

  const predefined = getAreasForCity(country, city)

  // Priority: community first (areas from other businesses in this city), then predefined; no duplicates
  const seen = new Set<string>()
  const merged: AreaSuggestion[] = []
  for (const a of [...community, ...predefined]) {
    const key = areaKey(a)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(a)
  }
  merged.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || '', 'en'))

  return NextResponse.json(merged)
}
