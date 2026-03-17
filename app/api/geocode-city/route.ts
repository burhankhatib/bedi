/**
 * GET /api/geocode-city?country=PS&city=Bethlehem
 * Returns { lat, lng } for a city center. Used to center the business location map
 * when Country and City are selected but no GPS location is set yet.
 *
 * For Palestine/Israel cities with defined polygons: uses centroid from geofencing.
 * For other cities: uses Nominatim forward geocoding.
 */
import { NextRequest, NextResponse } from 'next/server'
import { CITY_POLYGONS } from '@/lib/geofencing'

function centroid(coords: [number, number][]): [number, number] {
  if (!coords.length) return [0, 0]
  let sumLng = 0
  let sumLat = 0
  for (const [lng, lat] of coords) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / coords.length, sumLat / coords.length]
}

/** Normalize city name for matching (e.g. "Al-Bireh" matches "Ramallah" for combined polygon) */
function normalizeCity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')?.trim()
  const city = searchParams.get('city')?.trim()

  if (!country || !city) {
    return NextResponse.json({ error: 'Missing country or city' }, { status: 400 })
  }

  const cityNorm = normalizeCity(city)

  // 1. Try polygon centroid for known cities (PS/IL)
  for (const poly of CITY_POLYGONS) {
    const polyNorm = normalizeCity(poly.name)
    if (polyNorm === cityNorm) {
      const [lng, lat] = centroid(poly.coordinates)
      return NextResponse.json({ lat, lng })
    }
  }

  // 2. Al-Bireh uses Ramallah polygon (combined per business rules)
  if (cityNorm === 'al-bireh' || cityNorm === 'al bireh') {
    const ramallah = CITY_POLYGONS.find((p) => p.name === 'Ramallah')
    if (ramallah) {
      const [lng, lat] = centroid(ramallah.coordinates)
      return NextResponse.json({ lat, lng })
    }
  }

  // 3. Fallback: Nominatim forward geocoding
  const countryNames: Record<string, string> = {
    PS: 'Palestine',
    IL: 'Israel',
  }
  const countryName = countryNames[country.toUpperCase()] ?? country
  const searchQuery = `${city}, ${countryName}`
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'BediDelivery/1.0' },
      }
    )
    if (!res.ok) return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 })
    }
    const first = data[0]
    const lat = parseFloat(first.lat ?? '')
    const lng = parseFloat(first.lon ?? '')
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 502 })
    }
    return NextResponse.json({ lat, lng })
  } catch (e) {
    console.error('[geocode-city]', e)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }
}
