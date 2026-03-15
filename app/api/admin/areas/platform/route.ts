/**
 * GET /api/admin/areas/platform
 * Returns platform city polygons (GeoJSON) for the admin map.
 * Source: Sanity (platformArea) or fallback to geofencing.
 *
 * PATCH /api/admin/areas/platform
 * Save a platform area. Body: { name, coordinates }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getPlatformPolygons } from '@/lib/platform-polygons'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export const dynamic = 'force-dynamic'

async function checkSuperAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return false
  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  return isSuperAdminEmail(email)
}

/** Compute centroid of polygon for marker placement. */
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

/** GeoJSON FeatureCollection of platform cities. */
export async function GET() {
  const ok = await checkSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const polygons = await getPlatformPolygons()
  const features = polygons.map((city) => {
    const ring = [...city.coordinates]
    if (ring.length >= 3 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
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

  const geojson = {
    type: 'FeatureCollection' as const,
    features,
  }

  return NextResponse.json(geojson)
}

/** Save a platform area. Body: { name: string, coordinates: [number, number][] } */
export async function PATCH(request: NextRequest) {
  const ok = await checkSuperAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!token) {
    return NextResponse.json({ error: 'Sanity write token not configured' }, { status: 500 })
  }

  let body: { name?: string; newName?: string; coordinates?: [number, number][] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, newName, coordinates } = body
  const nameStr = name != null && typeof name === 'string' ? name.trim() : ''
  const newNameStr = newName != null && typeof newName === 'string' ? newName.trim() : ''

  const writeClient = client.withConfig({ token, useCdn: false })

  /** Rename only: { name, newName } */
  if (newNameStr && !coordinates) {
    if (!nameStr) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    const existing = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "platformArea" && name == $name][0]{ _id }`,
      { name: nameStr }
    )
    if (!existing) return NextResponse.json({ error: 'Area not found' }, { status: 404 })
    if (newNameStr === nameStr) return NextResponse.json({ ok: true, _id: existing._id })
    const dup = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "platformArea" && name == $newName && _id != $excludeId][0]{ _id }`,
      { newName: newNameStr, excludeId: existing._id }
    )
    if (dup) return NextResponse.json({ error: 'An area with that name already exists' }, { status: 400 })
    await writeClient.patch(existing._id).set({ name: newNameStr }).commit()
    return NextResponse.json({ ok: true, _id: existing._id })
  }

  /** Create or update polygon: { name, coordinates } */
  if (!nameStr || !Array.isArray(coordinates) || coordinates.length < 3) {
    return NextResponse.json({ error: 'Missing or invalid name or coordinates' }, { status: 400 })
  }

  const validCoords: [number, number][] = coordinates
    .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(([lng, lat]) => [lng, lat] as [number, number])

  if (validCoords.length < 3) {
    return NextResponse.json({ error: 'At least 3 valid coordinates required' }, { status: 400 })
  }

  const coordsJson = JSON.stringify(validCoords)
  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "platformArea" && name == $name][0]{ _id }`,
    { name: nameStr }
  )

  if (existing) {
    await writeClient.patch(existing._id).set({ coordinates: coordsJson }).commit()
    return NextResponse.json({ ok: true, _id: existing._id })
  }

  const created = await writeClient.create({
    _type: 'platformArea',
    name: nameStr,
    coordinates: coordsJson,
  })
  return NextResponse.json({ ok: true, _id: created._id })
}
