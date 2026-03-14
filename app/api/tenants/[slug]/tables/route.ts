import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'

const writeClient = clientNoCdn.withConfig({ token: token || undefined, useCdn: false })

/** GET tables for a tenant. Public so menu can validate ?table= when present. Uses CDN by default; add ?refresh=1 for fresh data. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const tenant = await getTenantBySlug(slug, { useCdn: !refresh })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const readClient = refresh ? clientNoCdn : client
  const list = await readClient.fetch<
  Array<{ _id: string; tableNumber: string; sortOrder?: number }>
  >(
    `*[_type == "tenantTable" && site._ref == $siteId] | order(sortOrder asc, tableNumber asc) { _id, tableNumber, sortOrder }`,
    { siteId: tenant._id }
  )
  return NextResponse.json(list ?? [], {
    headers: refresh ? { 'Cache-Control': 'no-store' } : { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}

/** POST: add table(s). Body: { tableNumbers: string[] } (e.g. ["1","2"] or ["1","2",...,"20"]) or { single: string } or { rangeFrom: number, rangeTo: number }. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  let toCreate: string[] = []

  if (Array.isArray(body.tableNumbers)) {
    toCreate = body.tableNumbers
      .map((n: unknown) => (typeof n === 'number' ? String(n) : typeof n === 'string' ? n.trim() : ''))
      .filter(Boolean)
  } else if (typeof body.single === 'string' && body.single.trim()) {
    toCreate = [body.single.trim()]
  } else if (typeof body.rangeFrom === 'number' && typeof body.rangeTo === 'number') {
    const from = Math.min(body.rangeFrom, body.rangeTo)
    const to = Math.max(body.rangeFrom, body.rangeTo)
    const max = Math.min(to - from + 1, 200)
    for (let i = 0; i < max; i++) toCreate.push(String(from + i))
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: 'Provide tableNumbers array, single, or rangeFrom/rangeTo' }, { status: 400 })
  }

  const existingList = await writeClient.fetch<string[]>(
    `*[_type == "tenantTable" && site._ref == $siteId].tableNumber`,
    { siteId: auth.tenantId }
  )
  const existingSet = new Set(existingList ?? [])
  const toInsert = toCreate.filter((n) => !existingSet.has(n))
  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'All table numbers already exist', created: [] }, { status: 400 })
  }

  const created: Array<{ _id: string; tableNumber: string }> = []
  for (let i = 0; i < toInsert.length; i++) {
    const doc = await writeClient.create({
      _type: 'tenantTable',
      site: { _type: 'reference', _ref: auth.tenantId },
      tableNumber: toInsert[i],
      sortOrder: i,
    })
    created.push({ _id: doc._id, tableNumber: toInsert[i] })
  }
  return NextResponse.json({ created, count: created.length })
}
