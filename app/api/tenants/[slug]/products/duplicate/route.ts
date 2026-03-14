import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { getProductLimit, getEffectivePlanTier } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const COPY_SUFFIX_EN = ' (Copy)'
const COPY_SUFFIX_AR = ' (نسخة)'

/** POST: Duplicate a product with all options (variants & addons) and images. Body: { productId } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  let body: { productId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const productId = body.productId && typeof body.productId === 'string' ? body.productId.trim() : null
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const existing = await writeClient.fetch<{
    _id: string
    site: { _ref: string }
    title_en?: string
    title_ar?: string
    description_en?: string
    description_ar?: string
    ingredients_en?: string[]
    ingredients_ar?: string[]
    price?: number
    specialPrice?: number
    specialPriceExpires?: string
    currency?: string
    category?: { _ref: string }
    sortOrder?: number
    isPopular?: boolean
    isAvailable?: boolean
    availableAgainAt?: string
    dietaryTags?: string[]
    addOns?: unknown[]
    variants?: unknown[]
    image?: { asset?: { _ref?: string } }
    additionalImages?: Array<{ asset?: { _ref?: string } }>
  } | null>(
    `*[_type == "product" && _id == $id && site._ref == $siteId][0]`,
    { id: productId, siteId: auth.tenantId }
  )

  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  const tier = tenant ? getEffectivePlanTier(tenant) : 'basic'
  const limit = getProductLimit(tier)
  if (limit !== null) {
    const count = await writeClient.fetch<number>(
      `count(*[_type == "product" && site._ref == $siteId])`,
      { siteId: auth.tenantId }
    )
    if (count >= limit) {
      const upgradeMsg = tier === 'basic'
        ? 'Product limit reached (30). Upgrade to Pro or Ultra in Billing.'
        : 'Product limit reached (50). Upgrade to Ultra for unlimited products in Billing.'
      return NextResponse.json(
        { error: upgradeMsg, code: 'PRODUCT_LIMIT_REACHED', limit, currentCount: count },
        { status: 403 }
      )
    }
  }

  const title_en = `${(existing.title_en ?? '').trim() || 'Product'}${COPY_SUFFIX_EN}`
  const title_ar = `${(existing.title_ar ?? '').trim() || 'منتج'}${COPY_SUFFIX_AR}`

  const doc: Record<string, unknown> = {
    _type: 'product',
    site: { _type: 'reference', _ref: auth.tenantId },
    title_en,
    title_ar,
    price: existing.price ?? 0,
    currency: existing.currency ?? 'ILS',
    category: existing.category ? { _type: 'reference', _ref: existing.category._ref } : undefined,
    sortOrder: typeof existing.sortOrder === 'number' ? existing.sortOrder : 0,
    isPopular: existing.isPopular === true,
    isAvailable: existing.isAvailable !== false,
  }
  if (existing.description_en != null) doc.description_en = existing.description_en
  if (existing.description_ar != null) doc.description_ar = existing.description_ar
  if (Array.isArray(existing.ingredients_en) && existing.ingredients_en.length) doc.ingredients_en = existing.ingredients_en
  if (Array.isArray(existing.ingredients_ar) && existing.ingredients_ar.length) doc.ingredients_ar = existing.ingredients_ar
  if (existing.specialPrice != null) doc.specialPrice = existing.specialPrice
  if (existing.specialPriceExpires) doc.specialPriceExpires = existing.specialPriceExpires
  if (existing.availableAgainAt) doc.availableAgainAt = existing.availableAgainAt
  if (Array.isArray(existing.dietaryTags) && existing.dietaryTags.length) doc.dietaryTags = existing.dietaryTags
  if (Array.isArray(existing.addOns) && existing.addOns.length) doc.addOns = existing.addOns
  if (Array.isArray(existing.variants) && existing.variants.length) doc.variants = existing.variants
  if (existing.image?.asset?._ref) {
    doc.image = { _type: 'image', asset: { _type: 'reference', _ref: existing.image.asset._ref } }
  }
  if (Array.isArray(existing.additionalImages) && existing.additionalImages.length) {
    doc.additionalImages = existing.additionalImages
      .filter((img) => img?.asset?._ref)
      .map((img) => ({ _type: 'image', asset: { _type: 'reference', _ref: img!.asset!._ref } }))
  }

  const created = await writeClient.create(doc as { _type: 'product'; [key: string]: unknown })
  return NextResponse.json(created)
}
