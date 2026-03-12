import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

const GROCERY_BUSINESS_TYPES = ['grocery', 'supermarket', 'greengrocer']

type CatalogProductResult = {
  _id: string
  title_en?: string
  title_ar?: string
  brand?: string
  description_en?: string
  description_ar?: string
  defaultUnit?: string
  images?: Array<{ asset?: { _ref?: string } }>
  categoryTitle?: string
  categoryId?: string
}

type TenantProductResult = {
  _id: string
  source: 'tenant'
  title_en?: string
  title_ar?: string
  price?: number
  currency?: string
  saleUnit?: string
  image?: { asset?: { _ref?: string } }
  categoryTitle?: string
}

/** GET: Browse catalog products + tenant products to add to your menu. For grocery-type tenants. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const qRaw = (searchParams.get('q') ?? '').trim()
  const q = qRaw.toLowerCase()
  const matchPattern = q ? `*${q.split(/\s+/).filter(Boolean).join('*')}*` : ''
  const categoryId = searchParams.get('categoryId') ?? ''
  const includeTenantProducts = searchParams.get('includeTenantProducts') !== 'false'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '80', 10) || 80, 150)

  const [catalogProducts, tenantProducts] = await Promise.all([
    client.fetch<CatalogProductResult[]>(
      `*[
        _type == "catalogProduct"
        ${q ? '&& (title_en match $matchPattern || title_ar match $matchPattern || brand match $matchPattern)' : ''}
        ${categoryId ? '&& category._ref == $categoryId' : ''}
      ] | order(title_en asc) [0...$limit] {
        _id,
        title_en,
        title_ar,
        brand,
        description_en,
        description_ar,
        defaultUnit,
        images,
        "categoryTitle": category->title_en,
        "categoryId": category._ref
      }`,
      {
        ...(matchPattern && { matchPattern }),
        ...(categoryId && { categoryId }),
        limit: Math.ceil(limit / 2),
      }
    ),
    includeTenantProducts
      ? client.fetch<TenantProductResult[]>(
          `*[
            _type == "product" &&
            defined(site) &&
            site._ref != $mySiteId &&
            site->businessType in $groceryTypes &&
            ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt))
            ${q ? '&& (title_en match $matchPattern || title_ar match $matchPattern)' : ''}
          ] | order(title_en asc) [0...$limit] {
            _id,
            title_en,
            title_ar,
            price,
            currency,
            saleUnit,
            image,
            "categoryTitle": category->title_en
          }`,
          {
            mySiteId: auth.tenantId,
            groceryTypes: GROCERY_BUSINESS_TYPES,
            ...(matchPattern && { matchPattern }),
            limit: Math.ceil(limit / 2),
          }
        )
      : Promise.resolve([]),
  ])

  const catalogNormalized = (catalogProducts ?? []).map((p) => ({
    ...p,
    source: 'catalog' as const,
  }))
  const tenantNormalized = (tenantProducts ?? []).map((p) => ({
    ...p,
    source: 'tenant' as const,
  }))

  const combined = [...catalogNormalized, ...tenantNormalized]
  return NextResponse.json(combined, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
