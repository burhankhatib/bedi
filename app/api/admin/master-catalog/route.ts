import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { urlFor } from '@/sanity/lib/image'
import { needsTranslation } from '@/lib/master-catalog-translation'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CATEGORIES = ['restaurant', 'cafe', 'bakery', 'grocery', 'retail', 'pharmacy', 'other'] as const
const UNIT_TYPES = ['kg', 'piece', 'pack'] as const

async function checkSuperAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false as const, status: 401 }
  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    email = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(email)) return { ok: false as const, status: 403 }
  if (!token) return { ok: false as const, status: 500 }
  return { ok: true as const }
}

/**
 * GET: List master catalog products (super admin only).
 * Pagination: limit=50, offset=0 by default. Search returns all matches.
 */
export async function GET(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authResult.status })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const category = req.nextUrl.searchParams.get('category')?.trim()
  const needsWorkOnly = req.nextUrl.searchParams.get('needsTranslation') === '1' || req.nextUrl.searchParams.get('needsWork') === '1'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 100)
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10))

  const items = await clientNoCdn.fetch<
    Array<{
      _id: string
      nameEn?: string
      nameAr?: string
      descriptionEn?: string
      descriptionAr?: string
      category?: string
      searchQuery?: string
      unitType?: string
      image?: { asset?: { _ref?: string } }
    }>
  >(
    `*[_type == "masterCatalogProduct" ${category ? '&& category == $category' : ''}] | order(nameEn asc) [0...10000] {
      _id, nameEn, nameAr, descriptionEn, descriptionAr, category, searchQuery, unitType,
      "image": image
    }`,
    category ? { category } : {}
  )

  const filtered = (items ?? []).filter((item) => {
    if (needsWorkOnly) {
      const normalized = {
        nameEn: item.nameEn ?? null,
        nameAr: item.nameAr ?? null,
        descriptionEn: item.descriptionEn ?? null,
        descriptionAr: item.descriptionAr ?? null,
        unitType: item.unitType ?? null,
      }
      if (!needsTranslation(normalized)) return false
    }
    if (!q) return true
    const haystack = [item.nameEn, item.nameAr, item.descriptionEn, item.descriptionAr, item.searchQuery].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q.toLowerCase())
  })

  const total = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  const withUrls = paginated.map((item) => {
    const imageRef = item.image?.asset?._ref
    const imageUrl = imageRef ? urlFor({ _type: 'image', asset: { _ref: imageRef } }).width(200).height(200).url() : null
    return {
      _id: item._id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      descriptionEn: item.descriptionEn,
      descriptionAr: item.descriptionAr,
      category: item.category,
      searchQuery: item.searchQuery,
      unitType: item.unitType,
      imageUrl,
    }
  })

  return NextResponse.json(
    { items: withUrls, total, hasMore: offset + limit < total },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

/**
 * POST: Create a master catalog product (super admin only).
 * Body: { nameEn, nameAr, category, unitType, searchQuery?, imageAssetId? }
 */
export async function POST(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authResult.status })
  }

  let body: { nameEn?: string; nameAr?: string; category?: string; unitType?: string; searchQuery?: string; imageAssetId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nameEn = typeof body.nameEn === 'string' ? body.nameEn.trim() : ''
  const nameAr = typeof body.nameAr === 'string' ? body.nameAr.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const unitType = typeof body.unitType === 'string' ? body.unitType.trim() : 'piece'
  const searchQuery = typeof body.searchQuery === 'string' ? body.searchQuery.trim() : ''
  const imageAssetId = typeof body.imageAssetId === 'string' ? body.imageAssetId.trim() : undefined

  if (!nameEn || !nameAr) {
    return NextResponse.json({ error: 'nameEn and nameAr are required' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(', ')}` }, { status: 400 })
  }
  if (!UNIT_TYPES.includes(unitType as (typeof UNIT_TYPES)[number])) {
    return NextResponse.json({ error: `unitType must be one of: ${UNIT_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!imageAssetId && (!searchQuery || searchQuery.length < 2)) {
    return NextResponse.json({ error: 'searchQuery is required when no image is uploaded (min 2 characters)' }, { status: 400 })
  }

  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "masterCatalogProduct" && nameEn == $nameEn && category == $category][0]{ _id }`,
    { nameEn, category }
  )
  if (existing) {
    return NextResponse.json({ error: 'A product with this name and category already exists' }, { status: 409 })
  }

  const doc: Record<string, unknown> = {
    _type: 'masterCatalogProduct',
    nameEn,
    nameAr,
    category,
    unitType,
    searchQuery: searchQuery || undefined,
  }
  if (imageAssetId) {
    doc.image = { _type: 'image', asset: { _type: 'reference', _ref: imageAssetId } }
  }

  try {
    const created = await writeClient.create(doc as { _type: 'masterCatalogProduct'; [key: string]: unknown })
    return NextResponse.json({ ok: true, _id: created._id, message: 'Product added to master catalog' })
  } catch (err) {
    console.error('[admin master-catalog] create error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to create'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
