import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { normalizeForSearch } from '@/lib/search/normalize'

export const revalidate = 60

const PAGE_SIZE = 200

type MasterCatalogRow = {
  _id: string
  nameEn?: string
  nameAr?: string
  category?: string
  searchQuery?: string
  unitType?: 'kg' | 'piece' | 'pack'
  image?: { asset?: { _ref?: string } }
}

/**
 * GET /api/tenants/[slug]/master-catalog?category=...&q=...&offset=...
 * Returns master catalog templates (paginated) and marks items already added by this tenant.
 * Uses Sanity CDN client to reduce API load; pagination keeps each request small (~200 items).
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
  const categoriesParam = (req.nextUrl.searchParams.get('categories') ?? '').trim()
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10) || 0)
  const requestedLimit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? String(PAGE_SIZE), 10) || PAGE_SIZE,
    500
  )
  const limit = Math.min(requestedLimit, PAGE_SIZE)

  const singleCategory =
    categoryRaw === 'supermarket' || categoryRaw === 'greengrocer' ? 'grocery' : categoryRaw
  const categories: string[] = categoriesParam
    ? categoriesParam.split(',').map((c) => c.trim()).filter(Boolean)
    : singleCategory
      ? [singleCategory]
      : []
  const qNormalized = normalizeForSearch(qRaw)
  const qTerms = qNormalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 2 && /[\w\u0600-\u06FF]/.test(t))

  const isSearch = qTerms.length > 0
  const fetchSize = isSearch ? Math.min(2000, 2500) : limit
  const fetchOffset = isSearch ? 0 : offset

  const [items, addedRefs] = await Promise.all([
    client.fetch<MasterCatalogRow[]>(
      `*[_type == "masterCatalogProduct" ${categories.length > 0 ? `&& category in $categories` : ''}] | order(nameEn asc) [$fetchOffset...$fetchEnd]{
        _id, nameEn, nameAr, category, searchQuery, unitType,
        "image": image
      }`,
      {
        ...(categories.length > 0 ? { categories } : {}),
        fetchOffset,
        fetchEnd: fetchOffset + fetchSize,
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

  const hasMore = !isSearch && items.length >= limit
  const resultItems = isSearch ? filtered : filtered.slice(0, limit)

  return NextResponse.json(
    {
      items: resultItems.map((item) => ({
        ...item,
        alreadyAdded: addedSet.has(item._id),
      })),
      hasMore,
      offset,
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}

