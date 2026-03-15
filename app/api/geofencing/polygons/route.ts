/**
 * GET /api/geofencing/polygons
 * Public API: returns platform city polygons for client-side geofencing.
 * Source: Sanity (platformArea) or fallback to static CITY_POLYGONS.
 */
import { NextResponse } from 'next/server'
import { getPlatformPolygons } from '@/lib/platform-polygons'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  const polygons = await getPlatformPolygons()
  const features = polygons.map((city) => {
    const ring = [...city.coordinates]
    if (
      ring.length >= 3 &&
      (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push(ring[0])
    }
    const [lng, lat] = centroid(city.coordinates)
    return {
      type: 'Feature' as const,
      properties: { name: city.name, centroid: { lat, lng } },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    }
  })

  return NextResponse.json({
    type: 'FeatureCollection' as const,
    features,
  })
}
