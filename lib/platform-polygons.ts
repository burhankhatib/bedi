/**
 * Platform city polygons for geofencing.
 * Fetches from Sanity (platformArea) when available; falls back to CITY_POLYGONS.
 */
import { client } from '@/sanity/lib/client'
import { CITY_POLYGONS, getCityFromCoordinates, type Polygon } from '@/lib/geofencing'

export type { Polygon }

/** Get city name from coordinates using platform polygons (Sanity or fallback). Server-side only. */
export async function getCityFromCoordinatesAsync(lon: number, lat: number): Promise<string | null> {
  const polygons = await getPlatformPolygons()
  return getCityFromCoordinates(lon, lat, polygons)
}

/** Fetch platform polygons from Sanity. Returns null if none exist. */
export async function getPlatformPolygonsFromSanity(): Promise<Polygon[] | null> {
  try {
    const docs = await client.fetch<
      { _id: string; name: string; coordinates: string }[]
    >(`*[_type == "platformArea"] | order(name asc) { _id, name, coordinates }`)
    if (!docs?.length) return null
    const polygons: Polygon[] = []
    for (const d of docs) {
      if (!d.name || !d.coordinates) continue
      let coords: [number, number][]
      try {
        coords = JSON.parse(d.coordinates) as [number, number][]
      } catch {
        continue
      }
      if (!Array.isArray(coords) || coords.length < 3) continue
      // Ensure closed ring
      const first = coords[0]
      const last = coords[coords.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords = [...coords, first]
      }
      polygons.push({ name: d.name, coordinates: coords })
    }
    return polygons.length > 0 ? polygons : null
  } catch {
    return null
  }
}

/** Get platform polygons: Sanity first, else CITY_POLYGONS. */
export async function getPlatformPolygons(): Promise<Polygon[]> {
  const fromSanity = await getPlatformPolygonsFromSanity()
  return fromSanity ?? CITY_POLYGONS
}
