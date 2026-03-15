import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { getProductLimit, getEffectivePlanTier } from '@/lib/subscription'
import { uploadImageFromUrl, type ClientWithUpload } from '@/lib/sanity-upload'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const GROCERY_BUSINESS_TYPES = ['grocery', 'supermarket', 'greengrocer']

type Body = {
  productId: string
  categoryId: string
  masterCatalogId?: string
  price?: number
  saleUnit?: string
  title_en?: string
  title_ar?: string
  imageAssetId?: string
  unsplashImageUrl?: string
  contributeImage?: boolean
}

/** POST: Add a product from catalog or another tenant. Body: { productId, categoryId, price?, title_en?, title_ar?, imageAssetId? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await checkTenantAuth(slug)
    if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
    if (!token) return NextResponse.json({ error: 'Server config: SANITY_API_TOKEN or SANITY_API required for creating products.' }, { status: 500 })

    let body: Body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const productId = body.productId?.trim()
    const categoryId = body.categoryId?.trim()
    const masterCatalogId = body.masterCatalogId?.trim()
    const priceOverride = typeof body.price === 'number' && body.price >= 0 ? body.price : undefined
    const saleUnitOverride = typeof body.saleUnit === 'string' && body.saleUnit.trim() ? body.saleUnit.trim() : undefined
    const titleEn = typeof body.title_en === 'string' ? body.title_en.trim() : undefined
    const titleAr = typeof body.title_ar === 'string' ? body.title_ar.trim() : undefined
    const imageAssetId = typeof body.imageAssetId === 'string' ? body.imageAssetId.trim() : undefined
    const unsplashImageUrl = typeof body.unsplashImageUrl === 'string' ? body.unsplashImageUrl.trim() : undefined
    const contributeImage = body.contributeImage === true

    if (!categoryId || (!productId && !masterCatalogId)) {
      return NextResponse.json({ error: 'categoryId and productId or masterCatalogId required' }, { status: 400 })
    }
    if (masterCatalogId && (priceOverride === undefined || priceOverride < 0)) {
      return NextResponse.json({ error: 'Price is required when adding from master catalog' }, { status: 400 })
    }

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

    const [categoryCheck, masterCatalogProduct, catalogProduct, tenantProduct] = await Promise.all([
      writeClient.fetch<{ _id: string } | null>(
        `*[_type == "category" && _id == $catId && site._ref == $siteId][0]{ _id }`,
        { catId: categoryId, siteId: auth.tenantId }
      ),
      masterCatalogId
        ? writeClient.fetch<{
            _id: string
            nameEn?: string
            nameAr?: string
            category?: string
            searchQuery?: string
            unitType?: string
            image?: { asset?: { _ref?: string } }
          } | null>(
            `*[_type == "masterCatalogProduct" && _id == $id][0]{
              _id, nameEn, nameAr, category, searchQuery, unitType,
              "image": image
            }`,
            { id: masterCatalogId }
          )
        : Promise.resolve(null),
      productId
        ? writeClient.fetch<{
            _id: string
            title_en?: string
            title_ar?: string
            brand?: string
            description_en?: string
            description_ar?: string
            defaultUnit?: string
            images?: Array<{ asset?: { _ref?: string } }>
            category?: { _ref: string }
          } | null>(`*[_type == "catalogProduct" && _id == $id][0]`, { id: productId })
        : Promise.resolve(null),
      productId
        ? writeClient.fetch<{
            _id: string
            site: { _ref: string }
            siteBusinessType?: string
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
            saleUnit?: string
            sortOrder?: number
            isPopular?: boolean
            isAvailable?: boolean
            dietaryTags?: string[]
            addOns?: unknown[]
            variants?: unknown[]
            image?: { asset?: { _ref?: string } }
            additionalImages?: Array<{ asset?: { _ref?: string } }>
          } | null>(
            `*[_type == "product" && _id == $id][0]{
              _id, "site": site, "siteBusinessType": site->businessType,
              title_en, title_ar, description_en, description_ar,
              ingredients_en, ingredients_ar, price, specialPrice, specialPriceExpires, currency,
              saleUnit, sortOrder, isPopular, isAvailable, dietaryTags, addOns, variants,
              image, additionalImages
            }`,
            { id: productId }
          )
        : Promise.resolve(null),
    ])

    if (!categoryCheck) return NextResponse.json({ error: 'Category not found or not yours' }, { status: 404 })

    if (masterCatalogProduct) {
      const title_en = titleEn || masterCatalogProduct.nameEn || 'Product'
      const title_ar = titleAr || masterCatalogProduct.nameAr || 'منتج'
      const price = priceOverride ?? 0
      const saleUnit = saleUnitOverride ?? masterCatalogProduct.unitType ?? 'piece'

      let resolvedImageAssetId: string | undefined = imageAssetId
      if (!resolvedImageAssetId && masterCatalogProduct.image?.asset?._ref) {
        resolvedImageAssetId = masterCatalogProduct.image.asset._ref
      }
      if (!resolvedImageAssetId && unsplashImageUrl) {
        try {
          const uploaded = await uploadImageFromUrl(writeClient as ClientWithUpload, unsplashImageUrl)
          resolvedImageAssetId = uploaded ?? undefined
        } catch {
          // Continue without image; we may use tempImageUrl as fallback
        }
      }

      const doc: Record<string, unknown> = {
        _type: 'product',
        site: { _type: 'reference', _ref: auth.tenantId },
        masterCatalogRef: { _type: 'reference', _ref: masterCatalogProduct._id },
        title_en,
        title_ar,
        price,
        saleUnit,
        currency: 'ILS',
        category: { _type: 'reference', _ref: categoryId },
        sortOrder: 0,
        isPopular: false,
        isAvailable: true,
      }
      if (resolvedImageAssetId) {
        doc.image = { _type: 'image', asset: { _type: 'reference', _ref: resolvedImageAssetId } }
      } else if (unsplashImageUrl) {
        doc.tempImageUrl = unsplashImageUrl
      }

      try {
        const created = await writeClient.create(doc as { _type: 'product'; [key: string]: unknown })
        return NextResponse.json(created)
      } catch (err) {
        console.error('[from-catalog] Create product error:', err)
        const msg = err instanceof Error ? err.message : 'Failed to create product'
        return NextResponse.json(
          { error: msg.includes('token') || msg.includes('Token') ? 'Server configuration error. Add SANITY_API_TOKEN with write access.' : msg },
          { status: 500 }
        )
      }
    }

    if (catalogProduct) {
      const title_en = titleEn || catalogProduct.title_en || 'Product'
      const title_ar = titleAr || catalogProduct.title_ar || 'منتج'
      const price = priceOverride ?? 0

      let imageRef = imageAssetId
      if (!imageRef && catalogProduct.images?.length) {
        const first = catalogProduct.images.find((img) => img?.asset?._ref)
        imageRef = first?.asset?._ref
      }

      const saleUnit = saleUnitOverride ?? catalogProduct.defaultUnit ?? 'piece'
      const doc: Record<string, unknown> = {
        _type: 'product',
        site: { _type: 'reference', _ref: auth.tenantId },
        catalogRef: { _type: 'reference', _ref: productId },
        title_en,
        title_ar,
        price,
        saleUnit,
        currency: 'ILS',
        category: { _type: 'reference', _ref: categoryId },
        sortOrder: 0,
        isPopular: false,
        isAvailable: true,
      }
      if (catalogProduct.description_en) doc.description_en = catalogProduct.description_en
      if (catalogProduct.description_ar) doc.description_ar = catalogProduct.description_ar
      if (imageRef) doc.image = { _type: 'image', asset: { _type: 'reference', _ref: imageRef } }

      const created = await writeClient.create(doc as { _type: 'product'; [key: string]: unknown })

      if (contributeImage && imageAssetId && !catalogProduct.images?.some((img) => img?.asset?._ref === imageAssetId)) {
        const currentImages = catalogProduct.images ?? []
        const newImages = [...currentImages.map((img) => ({ _type: 'image' as const, asset: { _type: 'reference' as const, _ref: img!.asset!._ref } })), { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: imageAssetId } }]
        await writeClient.patch(productId).set({ images: newImages }).commit()
      }

      return NextResponse.json(created)
    }

    if (tenantProduct) {
      if (tenantProduct.site?._ref === auth.tenantId) {
        return NextResponse.json({ error: 'Use duplicate for your own products' }, { status: 400 })
      }
      if (!GROCERY_BUSINESS_TYPES.includes(tenantProduct.siteBusinessType ?? '')) {
        return NextResponse.json({ error: 'Product must be from a market or greengrocer' }, { status: 403 })
      }

      const title_en = (titleEn || tenantProduct.title_en) ?? 'Product'
      const title_ar = (titleAr || tenantProduct.title_ar) ?? 'منتج'
      const price = priceOverride ?? tenantProduct.price ?? 0
      const imageRef = imageAssetId || tenantProduct.image?.asset?._ref

      const saleUnit = saleUnitOverride ?? tenantProduct.saleUnit ?? 'piece'
      const doc: Record<string, unknown> = {
        _type: 'product',
        site: { _type: 'reference', _ref: auth.tenantId },
        title_en,
        title_ar,
        price,
        saleUnit,
        currency: tenantProduct.currency ?? 'ILS',
        category: { _type: 'reference', _ref: categoryId },
        sortOrder: tenantProduct.sortOrder ?? 0,
        isPopular: tenantProduct.isPopular === true,
        isAvailable: true,
      }
      if (tenantProduct.description_en) doc.description_en = tenantProduct.description_en
      if (tenantProduct.description_ar) doc.description_ar = tenantProduct.description_ar
      if (Array.isArray(tenantProduct.ingredients_en) && tenantProduct.ingredients_en.length) doc.ingredients_en = tenantProduct.ingredients_en
      if (Array.isArray(tenantProduct.ingredients_ar) && tenantProduct.ingredients_ar.length) doc.ingredients_ar = tenantProduct.ingredients_ar
      if (tenantProduct.specialPrice != null) doc.specialPrice = tenantProduct.specialPrice
      if (tenantProduct.specialPriceExpires) doc.specialPriceExpires = tenantProduct.specialPriceExpires
      if (Array.isArray(tenantProduct.dietaryTags) && tenantProduct.dietaryTags.length) doc.dietaryTags = tenantProduct.dietaryTags
      if (Array.isArray(tenantProduct.addOns) && tenantProduct.addOns.length) doc.addOns = tenantProduct.addOns
      if (Array.isArray(tenantProduct.variants) && tenantProduct.variants.length) doc.variants = tenantProduct.variants
      if (imageRef) doc.image = { _type: 'image', asset: { _type: 'reference', _ref: imageRef } }
      if (Array.isArray(tenantProduct.additionalImages) && tenantProduct.additionalImages.length) {
        doc.additionalImages = tenantProduct.additionalImages
          .filter((img) => img?.asset?._ref)
          .map((img) => ({ _type: 'image', asset: { _type: 'reference', _ref: img!.asset!._ref } }))
      }

      const created = await writeClient.create(doc as { _type: 'product'; [key: string]: unknown })
      return NextResponse.json(created)
    }

    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  } catch (err) {
    console.error('[from-catalog] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const sanitized = msg.includes('token') || msg.includes('Token')
      ? 'Server configuration error. Add SANITY_API_TOKEN with write access.'
      : msg
    return NextResponse.json({ error: sanitized }, { status: 500 })
  }
}
