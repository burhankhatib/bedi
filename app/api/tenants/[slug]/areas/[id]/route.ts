import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function checkAreaOwnership(slug: string, id: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { auth: null as never, doc: null }
  const doc = await client.fetch<{ _id: string; site: { _ref: string } } | null>(
    `*[_type == "area" && _id == $id][0]{ _id, site }`,
    { id }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { auth, doc: null }
  return { auth, doc }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkAreaOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (body.name_en != null) patch.name_en = body.name_en
  if (body.name_ar != null) patch.name_ar = body.name_ar
  if (body.deliveryPrice != null) patch.deliveryPrice = Number(body.deliveryPrice)
  if (body.currency != null) patch.currency = body.currency
  if (body.isActive != null) patch.isActive = body.isActive
  if (body.sortOrder != null) patch.sortOrder = body.sortOrder
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  await writeClient.patch(id).set(patch).commit()
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkAreaOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
