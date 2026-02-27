import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { City } = require('country-state-city')

/** Fallback cities for countries not covered or empty in country-state-city */
const FALLBACK_CITIES: Record<string, string[]> = {
  PS: [
    'Bethany',
    'Al-Bireh',
    'Anabta',
    'Ariha',
    'Bani Na\'im',
    'Beit Hanoun',
    'Beit Lahia',
    'Bethlehem',
    'Deir al-Balah',
    'Dura',
    'Gaza',
    'Halhul',
    'Hebron',
    'Jabalia',
    'Jenin',
    'Jericho',
    'Jerusalem',
    'Khan Yunis',
    'Nablus',
    'Qalqilya',
    'Rafah',
    'Ramallah',
    'Salfit',
    'Tubas',
    'Tulkarm',
    'Yatta',
  ],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')
  if (!country) {
    return NextResponse.json([])
  }
  // Use fallback if we have one (e.g. Palestine has no cities in the package)
  const fallback = FALLBACK_CITIES[country.toUpperCase()]
  if (fallback) {
    return NextResponse.json(fallback)
  }
  try {
    const list = City.getCitiesOfCountry(country) as Array<{ name: string; stateCode?: string }>
    if (!list || !list.length) return NextResponse.json([])
    // Dedupe by name (some countries have same city name in different states); keep first occurrence
    const seen = new Set<string>()
    const names = list
      .map((c) => c.name)
      .filter((name) => {
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
      .sort((a, b) => a.localeCompare(b))
    return NextResponse.json(names)
  } catch (e) {
    console.error('[cities]', e)
    return NextResponse.json([])
  }
}
