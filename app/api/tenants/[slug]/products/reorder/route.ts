import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type ReorderItem = { _id: string; sortOrder: number; categoryId?: string }

/**
 * POST /api/tenants/[slug]/products/reorder
 * Body: { updates: ReorderItem[] }
 * Updates sortOrder (and optionally categoryId) for multiple products in one request.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const updates = Array.isArray(body?.updates) ? body.updates as ReorderItem[] : []
  if (updates.length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 })

  const ids = updates.map((u) => u._id).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'No valid ids' }, { status: 400 })

  const allowedRaw = await client.fetch<string[] | { _id: string }[]>(
    `*[_type == "product" && _id in $ids && site._ref == $siteId]._id`,
    { ids, siteId: auth.tenantId }
  )
  const allowedIds = (Array.isArray(allowedRaw) ? allowedRaw : []).map((x) => (typeof x === 'string' ? x : x._id))
  const allowedSet = new Set(allowedIds)
  const toApply = updates.filter((u) => allowedSet.has(u._id))
  if (toApply.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    let tx = writeClient.transaction()
    for (const u of toApply) {
      const set: Record<string, unknown> = { sortOrder: Number(u.sortOrder) }
      if (u.categoryId != null) set.category = { _type: 'reference', _ref: u.categoryId }
      tx = tx.patch(u._id, (p) => p.set(set))
    }
    await tx.commit()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[products/reorder]', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
