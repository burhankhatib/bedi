import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { uploadImageFromUrl, type ClientWithUpload } from '@/lib/sanity-upload'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const PRODUCT_FIELDS = `_id, title_en, title_ar, description_en, description_ar, ingredients_en, ingredients_ar, price, specialPrice, specialPriceExpires, currency, image, additionalImages, "categoryRef": category._ref, sortOrder, isPopular, isAvailable, availableAgainAt, dietaryTags, addOns, variants`

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  // use writeClient (no CDN) so new products show immediately after create / live refresh
  const list = await writeClient.fetch<Array<Record<string, unknown>>>(
    `*[_type == "product" && site._ref == $siteId] | order(sortOrder asc) { ${PRODUCT_FIELDS} }`,
    { siteId: auth.tenantId }
  )
  const normalized = (list || []).map((p) => ({
    ...p,
    categoryId: p.categoryRef ?? p.category,
  }))
  return NextResponse.json(normalized, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const {
    title_en,
    title_ar,
    description_en,
    description_ar,
    ingredients_en,
    ingredients_ar,
    price,
    specialPrice,
    specialPriceExpires,
    currency,
    categoryId,
    sortOrder,
    isPopular,
    isAvailable,
    availableAgainAt,
    dietaryTags,
    addOns,
    variants,
    imageUrl,
    additionalImageUrls,
    imageAssetId,
    additionalImageAssetIds,
  } = body as Record<string, unknown>

  if (!title_en || !title_ar || price == null || !categoryId) {
    return NextResponse.json({ error: 'title_en, title_ar, price and categoryId required' }, { status: 400 })
  }

  let imageRef: string | null = (imageAssetId && typeof imageAssetId === 'string') ? imageAssetId : null
  const additionalRefs: string[] = Array.isArray(additionalImageAssetIds)
    ? additionalImageAssetIds.filter((id): id is string => typeof id === 'string')
    : []
  if (!imageRef && imageUrl && typeof imageUrl === 'string') {
    imageRef = await uploadImageFromUrl(writeClient as ClientWithUpload, imageUrl)
  }
  if (additionalRefs.length === 0 && additionalImageUrls && Array.isArray(additionalImageUrls) && additionalImageUrls.length > 0) {
    for (const u of additionalImageUrls) {
      if (typeof u !== 'string') continue
      const ref = await uploadImageFromUrl(writeClient as ClientWithUpload, u)
      if (ref) additionalRefs.push(ref)
    }
  }

  const doc = {
    _type: 'product',
    site: { _type: 'reference' as const, _ref: auth.tenantId },
    title_en: String(title_en),
    title_ar: String(title_ar),
    price: Number(price),
    currency: (currency as string) || 'ILS',
    category: { _type: 'reference' as const, _ref: categoryId },
    sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    isPopular: isPopular === true,
    isAvailable: isAvailable !== false,
    ...(description_en != null && { description_en: String(description_en) }),
    ...(description_ar != null && { description_ar: String(description_ar) }),
    ...(ingredients_en != null && Array.isArray(ingredients_en) && { ingredients_en }),
    ...(ingredients_ar != null && Array.isArray(ingredients_ar) && { ingredients_ar }),
    ...(specialPrice != null && { specialPrice: Number(specialPrice) }),
    ...(specialPriceExpires != null && { specialPriceExpires }),
    ...(availableAgainAt != null && { availableAgainAt }),
    ...(dietaryTags != null && Array.isArray(dietaryTags) && { dietaryTags }),
    ...(addOns != null && Array.isArray(addOns) && { addOns }),
    ...(variants != null && Array.isArray(variants) && { variants }),
    ...(imageRef && { image: { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: imageRef } } }),
    ...(additionalRefs.length > 0 && {
      additionalImages: additionalRefs.map((_ref) => ({ _type: 'image' as const, asset: { _type: 'reference' as const, _ref } })),
    }),
  }
  const created = await writeClient.create(doc)
  return NextResponse.json(created)
}
