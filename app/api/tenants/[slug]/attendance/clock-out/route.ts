import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { coerceLatLng, isWithinAttendanceRadius } from '@/lib/staff-attendance'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenantAuth = await checkTenantAuth(slug)
  if (!tenantAuth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: tenantAuth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const email = (await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null) || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'User email not found' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const coords = coerceLatLng(body)
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  const tenant = await noCacheClient.fetch<{ locationLat?: number | null; locationLng?: number | null } | null>(
    `*[_type == "tenant" && _id == $id][0]{ locationLat, locationLng }`,
    { id: tenantAuth.tenantId }
  )

  const openSession = await noCacheClient.fetch<{
    _id: string
    clockInAt?: string
  } | null>(
    `*[
      _type == "staffAttendanceSession" &&
      site._ref == $tenantId &&
      status == "open" &&
      actorEmail == $email
    ][0]{ _id, clockInAt }`,
    { tenantId: tenantAuth.tenantId, email }
  )
  if (!openSession?._id) {
    return NextResponse.json({ error: 'No open attendance session found' }, { status: 404 })
  }

  let distanceMeters: number | undefined
  let clockOutMethod: 'manual' | 'auto_geofence_exit' = 'manual'
  if (
    coords &&
    tenant?.locationLat != null &&
    tenant?.locationLng != null &&
    Number.isFinite(tenant.locationLat) &&
    Number.isFinite(tenant.locationLng)
  ) {
    const radius = isWithinAttendanceRadius(
      { lat: tenant.locationLat, lng: tenant.locationLng },
      coords
    )
    distanceMeters = radius.distanceMeters
    if (!radius.within) clockOutMethod = 'auto_geofence_exit'
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const clockInMs = openSession.clockInAt ? new Date(openSession.clockInAt).getTime() : NaN
  const totalMinutes =
    Number.isFinite(clockInMs) ? Math.max(0, Math.round((now.getTime() - clockInMs) / 60000)) : 0

  await writeClient.patch(openSession._id).set({
    status: 'closed',
    clockOutAt: nowIso,
    ...(coords ? { clockOutLat: coords.lat, clockOutLng: coords.lng } : {}),
    ...(distanceMeters != null ? { clockOutDistanceMeters: distanceMeters } : {}),
    clockOutMethod,
    ...(reason ? { clockOutReason: reason } : {}),
    closedByEmail: email,
    totalMinutes,
  }).commit()

  return NextResponse.json({
    success: true,
    sessionId: openSession._id,
    clockOutAt: nowIso,
    totalMinutes,
    clockOutMethod,
    ...(distanceMeters != null ? { distanceMeters } : {}),
  })
}

