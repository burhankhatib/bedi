import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { normalizeForSearch } from '@/lib/search/normalize'

export const revalidate = 60

type MasterCatalogRow = {
  _id: string
  nameEn?: string
  nameAr?: string
  category?: string
  searchQuery?: string
  unitType?: 'kg' | 'piece' | 'pack'
}

/**
 * GET /api/tenants/[slug]/master-catalog?category=...&q=...
 * Returns master catalog templates and marks items already added by this tenant.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const qRaw = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const categoryRaw = (req.nextUrl.searchParams.get('category') ?? '').trim()
  // Map supermarket, greengrocer (vegetable & fruit stores) → grocery so they see grocery catalog items
  const category =
    categoryRaw === 'supermarket' || categoryRaw === 'greengrocer' ? 'grocery' : categoryRaw
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10) || 100, 200)
  const qNormalized = normalizeForSearch(qRaw)
  const qTerms = qNormalized.split(/\s+/).filter(Boolean)

  const [items, addedRefs] = await Promise.all([
    client.fetch<MasterCatalogRow[]>(
      `*[_type == "masterCatalogProduct" ${category ? '&& (category == $category || lower(category) == lower($category))' : ''}] | order(nameEn asc) [0...$limit]{
        _id, nameEn, nameAr, category, searchQuery, unitType
      }`,
      {
        ...(category ? { category } : {}),
        // fetch a broader set then apply robust normalized filtering in JS for Arabic/English.
        limit: Math.max(limit, 300),
      }
    ),
    client.fetch<Array<{ _id: string; ref?: string }>>(
      `*[_type == "product" && site._ref == $siteId && defined(masterCatalogRef)]{
        _id,
        "ref": masterCatalogRef._ref
      }`,
      { siteId: auth.tenantId }
    ),
  ])

  const addedSet = new Set((addedRefs ?? []).map((r) => r.ref).filter(Boolean))

  const filtered = (items ?? []).filter((item) => {
    if (!qTerms.length) return true
    const haystack = normalizeForSearch(
      [item.nameEn, item.nameAr, item.searchQuery].filter(Boolean).join(' ')
    )
    return qTerms.every((term) => haystack.includes(term))
  })

  return NextResponse.json(
    filtered.slice(0, limit).map((item) => ({
      ...item,
      alreadyAdded: addedSet.has(item._id),
    })),
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}

