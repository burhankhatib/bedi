import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { toEnglishDigits } from '@/lib/phone'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function resolveFleetEntry(slug: string, id: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { auth: null as never, kind: null as never, doc: null }
  const siteId = auth.tenantId
  const tenantDriver = await client.fetch<{ _id: string; site: { _ref: string } } | null>(
    `*[_type == "tenantDriver" && _id == $id && site._ref == $siteId][0]{ _id, site }`,
    { id, siteId }
  )
  if (tenantDriver) return { auth, kind: 'tenantDriver' as const, doc: tenantDriver }
  const legacyDriver = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "driver" && _id == $id && site._ref == $siteId][0]{ _id, site }`,
    { id, siteId }
  )
  if (legacyDriver) return { auth, kind: 'driver' as const, doc: legacyDriver }
  return { auth, kind: null, doc: null }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, kind, doc } = await resolveFleetEntry(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  if (kind === 'tenantDriver') {
    const patch: Record<string, unknown> = {}
    if (body.customName !== undefined) patch.customName = body.customName ? String(body.customName).trim() : undefined
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive)
    if (body.deliveryAreaIds !== undefined) {
      patch.deliveryAreas = Array.isArray(body.deliveryAreaIds)
        ? body.deliveryAreaIds.map((refId: string) => ({ _type: 'reference', _ref: refId }))
        : []
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    await writeClient.patch(id).set(patch).commit()
    return NextResponse.json({ ok: true })
  }
  const patch: Record<string, unknown> = {}
  if (body.name != null) patch.name = String(body.name)
  if (body.phoneNumber != null) patch.phoneNumber = toEnglishDigits(String(body.phoneNumber)).replace(/\s/g, '')
  if (body.vehicleType !== undefined) patch.vehicleType = body.vehicleType ? String(body.vehicleType) : undefined
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive)
  if (body.deliveryAreaIds !== undefined) {
    patch.deliveryAreas = Array.isArray(body.deliveryAreaIds)
      ? body.deliveryAreaIds.map((refId: string) => ({ _type: 'reference', _ref: refId }))
      : []
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  await writeClient.patch(id).set(patch).commit()
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, kind, doc } = await resolveFleetEntry(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
