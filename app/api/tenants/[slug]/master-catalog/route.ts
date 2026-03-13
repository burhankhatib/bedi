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
  image?: { asset?: { _ref?: string } }
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
  const categoriesParam = (req.nextUrl.searchParams.get('categories') ?? '').trim()
  // Map supermarket, greengrocer (vegetable & fruit stores) → grocery so they see grocery catalog items
  const singleCategory =
    categoryRaw === 'supermarket' || categoryRaw === 'greengrocer' ? 'grocery' : categoryRaw
  // Support multiple categories (e.g. for restaurant/cafe: grocery,bakery)
  const categories: string[] = categoriesParam
    ? categoriesParam.split(',').map((c) => c.trim()).filter(Boolean)
    : singleCategory
      ? [singleCategory]
      : []
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10) || 100, 200)
  const qNormalized = normalizeForSearch(qRaw)
  const qTerms = qNormalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 2 && /[\w\u0600-\u06FF]/.test(t)) // require letters/digits, ignore pure punctuation

  const [items, addedRefs] = await Promise.all([
    client.fetch<MasterCatalogRow[]>(
      `*[_type == "masterCatalogProduct" ${categories.length > 0 ? `&& category in $categories` : ''}] | order(nameEn asc) [0...$limit]{
        _id, nameEn, nameAr, category, searchQuery, unitType,
        "image": image
      }`,
      {
        ...(categories.length > 0 ? { categories } : {}),
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

