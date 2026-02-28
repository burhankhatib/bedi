import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'

/**
 * POST /api/tenants/[slug]/location
 * Save GPS coordinates as the business location.
 * Requires settings_business permission (owner / manager level).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!requirePermission(auth, 'settings_business')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const lat = typeof body.lat === 'number' ? body.lat : undefined
  const lng = typeof body.lng === 'number' ? body.lng : undefined

  if (lat === undefined || lng === undefined || !isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng (numbers) are required' }, { status: 400 })
  }

  const writeClient = client.withConfig({ token, useCdn: false })
  await writeClient.patch(auth.tenantId!).set({ locationLat: lat, locationLng: lng }).commit()

  return NextResponse.json({ ok: true, lat, lng })
}
