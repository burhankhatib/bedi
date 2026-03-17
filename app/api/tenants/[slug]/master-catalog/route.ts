import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { normalizeForSearch } from '@/lib/search/normalize'
import { getKeywordsForSubcategory } from '@/lib/master-catalog-subcategory-keywords'

export const revalidate = 60

const PAGE_SIZE = 200
const MAX_KEYWORD_PATTERNS = 12 // Limit GROQ OR clauses for subcategory context

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
 * Build GROQ match patterns for text search. Each term becomes "term*" for prefix match.
 */
function buildMatchParams(terms: string[]): { filter: string; params: Record<string, string> } {
  const safeTerms = terms
    .slice(0, 8)
    .map((t) => t.replace(/[*"]/g, ''))
    .filter((t) => t.length >= 2)
  if (safeTerms.length === 0) return { filter: '', params: {} }
  const clauses = safeTerms.flatMap((_, i) => [
    `nameEn match $m${i}`,
    `nameAr match $m${i}`,
    `searchQuery match $m${i}`,
  ])
  const params: Record<string, string> = {}
  safeTerms.forEach((t, i) => {
    params[`m${i}`] = `${t}*`
  })
  return { filter: `(${clauses.join(' || ')})`, params }
}

/**
 * Build GROQ filter for subcategory context using predefined keywords.
 */
function buildSubcategoryFilter(menuCategoryTitle: string): { filter: string; params: Record<string, string> } {
  const keywords = getKeywordsForSubcategory(menuCategoryTitle).slice(0, MAX_KEYWORD_PATTERNS)
  if (keywords.length === 0) return { filter: '', params: {} }
  const clauses = keywords.flatMap((_, i) => [
    `nameEn match $k${i}`,
    `nameAr match $k${i}`,
  ])
  const params: Record<string, string> = {}
  keywords.forEach((kw, i) => {
    params[`k${i}`] = `${kw.replace(/[*"]/g, '')}*`
  })
  return { filter: `(${clauses.join(' || ')})`, params }
}

/**
 * GET /api/tenants/[slug]/master-catalog?category=...&q=...&offset=...&menuCategoryTitle=...
 * Returns master catalog templates (paginated) and marks items already added by this tenant.
 * - q: text search (uses GROQ match for efficient filtering with 6000+ products)
 * - menuCategoryTitle: when set (e.g. "Vegetables"), filters to products matching that subcategory's keywords for easy quick-add
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const qRaw = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const menuCategoryTitle = (req.nextUrl.searchParams.get('menuCategoryTitle') ?? '').trim()
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

  const isTextSearch = qTerms.length > 0
  const hasSubcategoryContext = menuCategoryTitle.length > 0
  const subcategoryMatch = hasSubcategoryContext ? buildSubcategoryFilter(menuCategoryTitle) : { filter: '', params: {} }
  const textMatch = isTextSearch ? buildMatchParams(qTerms) : { filter: '', params: {} }

  // Build GROQ filter: category + optional text search + optional subcategory context
  const filters: string[] = ['_type == "masterCatalogProduct"']
  if (categories.length > 0) filters.push('category in $categories')
  if (textMatch.filter) filters.push(textMatch.filter)
  if (subcategoryMatch.filter && !isTextSearch) {
    // When user has chosen a category (e.g. Vegetables) and hasn't typed a search, show relevant products
    filters.push(subcategoryMatch.filter)
  }
  const groqFilter = filters.join(' && ')

  const fetchSize = isTextSearch || subcategoryMatch.filter
    ? Math.min(1500, 2000)
    : limit
  const fetchOffset = isTextSearch || subcategoryMatch.filter ? 0 : offset

  const [items, addedRefs] = await Promise.all([
    client.fetch<MasterCatalogRow[]>(
      `*[${groqFilter}] | order(nameEn asc) [$fetchOffset...$fetchEnd]{
        _id, nameEn, nameAr, category, searchQuery, unitType,
        "image": image
      }`,
      {
        ...(categories.length > 0 ? { categories } : {}),
        ...textMatch.params,
        ...subcategoryMatch.params,
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

  // When subcategory filter matched in GROQ, items are already filtered. For text-only search, GROQ did the work.
  const hasMore = !isTextSearch && !subcategoryMatch.filter && (items?.length ?? 0) >= limit
  const resultItems = (items ?? []).slice(0, isTextSearch || subcategoryMatch.filter ? 200 : limit)

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

