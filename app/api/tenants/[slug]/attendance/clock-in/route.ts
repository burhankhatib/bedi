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
  if (!coords) {
    return NextResponse.json({ error: 'Valid location is required (lat/lng)' }, { status: 400 })
  }

  const tenant = await noCacheClient.fetch<{ locationLat?: number | null; locationLng?: number | null } | null>(
    `*[_type == "tenant" && _id == $id][0]{ locationLat, locationLng }`,
    { id: tenantAuth.tenantId }
  )
  if (
    tenant?.locationLat == null ||
    tenant?.locationLng == null ||
    !Number.isFinite(tenant.locationLat) ||
    !Number.isFinite(tenant.locationLng)
  ) {
    return NextResponse.json(
      { error: 'Business location is not configured. Set business location first.' },
      { status: 400 }
    )
  }

  const radius = isWithinAttendanceRadius(
    { lat: tenant.locationLat, lng: tenant.locationLng },
    coords
  )
  if (!radius.within) {
    return NextResponse.json(
      {
        error: 'Clock-in is allowed only inside 50 meters from business location.',
        distanceMeters: radius.distanceMeters,
      },
      { status: 403 }
    )
  }

  const staff = await noCacheClient.fetch<{ _id: string; status?: string } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $email][0]{ _id, status }`,
    { tenantId: tenantAuth.tenantId, email }
  )
  if (staff?.status && staff.status !== 'active') {
    return NextResponse.json({ error: 'Staff account is not active' }, { status: 403 })
  }

  const openSession = await noCacheClient.fetch<{ _id: string } | null>(
    `*[
      _type == "staffAttendanceSession" &&
      site._ref == $tenantId &&
      status == "open" &&
      actorEmail == $email
    ][0]{ _id }`,
    { tenantId: tenantAuth.tenantId, email }
  )
  if (openSession?._id) {
    return NextResponse.json(
      { error: 'There is already an open attendance session', sessionId: openSession._id },
      { status: 409 }
    )
  }

  const nowIso = new Date().toISOString()
  const created = await writeClient.create({
    _type: 'staffAttendanceSession',
    site: { _type: 'reference', _ref: tenantAuth.tenantId },
    ...(staff?._id ? { staff: { _type: 'reference', _ref: staff._id } } : {}),
    actorEmail: email,
    actorRole: tenantAuth.role,
    status: 'open',
    clockInAt: nowIso,
    clockInLat: coords.lat,
    clockInLng: coords.lng,
    clockInDistanceMeters: radius.distanceMeters,
  })

  return NextResponse.json({
    success: true,
    sessionId: created._id,
    clockInAt: nowIso,
    distanceMeters: radius.distanceMeters,
  })
}

