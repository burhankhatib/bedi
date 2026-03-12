import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { uploadImageFromUrl, type ClientWithUpload } from '@/lib/sanity-upload'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function checkProductOwnership(slug: string, id: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { auth: null as never, doc: null }
  const doc = await client.fetch<{ _id: string; site: { _ref: string }; catalogRef?: { _ref: string } } | null>(
    `*[_type == "product" && _id == $id][0]{ _id, site, catalogRef }`,
    { id }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { auth, doc: null }
  return { auth, doc }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkProductOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  const unsetFields: string[] = []
  const set = (key: string, value: unknown) => { if (value !== undefined) patch[key] = value }

  set('title_en', body.title_en)
  set('title_ar', body.title_ar)
  set('description_en', body.description_en)
  set('description_ar', body.description_ar)
  set('ingredients_en', Array.isArray(body.ingredients_en) ? body.ingredients_en : undefined)
  set('ingredients_ar', Array.isArray(body.ingredients_ar) ? body.ingredients_ar : undefined)
  set('price', body.price != null ? Number(body.price) : undefined)

  // Special price: handle set, clear (null/''), and datetime conversion for Sanity ISO 8601
  if (body.specialPrice != null && body.specialPrice !== '') {
    set('specialPrice', Number(body.specialPrice))
  } else if (body.specialPrice === null || body.specialPrice === '') {
    unsetFields.push('specialPrice')
  }
  if (body.specialPriceExpires != null && String(body.specialPriceExpires).trim()) {
    const raw = String(body.specialPriceExpires).trim()
    const d = new Date(raw)
    set('specialPriceExpires', !isNaN(d.getTime()) ? d.toISOString() : raw)
  } else if (body.specialPriceExpires === null || body.specialPriceExpires === '') {
    unsetFields.push('specialPriceExpires')
  }
  set('currency', body.currency)
  set('saleUnit', body.saleUnit != null ? String(body.saleUnit).trim() || 'piece' : undefined)
  set('category', body.categoryId != null ? { _type: 'reference', _ref: body.categoryId } : undefined)
  set('sortOrder', body.sortOrder != null ? Number(body.sortOrder) : undefined)
  set('isPopular', body.isPopular)
  set('isAvailable', body.isAvailable)
  set('availableAgainAt', body.availableAgainAt)
  set('dietaryTags', Array.isArray(body.dietaryTags) ? body.dietaryTags : undefined)
  set('addOns', Array.isArray(body.addOns) ? body.addOns : undefined)
  set('variants', Array.isArray(body.variants) ? body.variants : undefined)

  if (body.imageAssetId && typeof body.imageAssetId === 'string') {
    patch.image = { _type: 'image', asset: { _type: 'reference', _ref: body.imageAssetId } }
  } else if (body.imageUrl && typeof body.imageUrl === 'string') {
    const imageRef = await uploadImageFromUrl(writeClient as ClientWithUpload, body.imageUrl)
    if (imageRef) patch.image = { _type: 'image', asset: { _type: 'reference', _ref: imageRef } }
  }
  if (Array.isArray(body.additionalImageAssetIds)) {
    if (body.additionalImageAssetIds.length > 0) {
      const refs = body.additionalImageAssetIds.filter((id: unknown): id is string => typeof id === 'string')
      if (refs.length > 0) {
        patch.additionalImages = refs.map((_ref: string) => ({ _type: 'image', asset: { _type: 'reference', _ref } }))
      }
    } else {
      unsetFields.push('additionalImages')
    }
  } else if (body.additionalImageUrls && Array.isArray(body.additionalImageUrls) && body.additionalImageUrls.length > 0) {
    const refs: string[] = []
    for (const u of body.additionalImageUrls) {
      if (typeof u !== 'string') continue
      const ref = await uploadImageFromUrl(writeClient as ClientWithUpload, u)
      if (ref) refs.push(ref)
    }
    if (refs.length > 0) {
      patch.additionalImages = refs.map((_ref: string) => ({ _type: 'image', asset: { _type: 'reference', _ref } }))
    }
  }

  if (Object.keys(patch).length === 0 && unsetFields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  let p = writeClient.patch(id)
  if (Object.keys(patch).length > 0) p = p.set(patch)
  if (unsetFields.length > 0) p = p.unset(unsetFields)
  await p.commit()

  if (body.contributeImageToCatalog === true && body.imageAssetId && doc?.catalogRef?._ref) {
    const catalog = await writeClient.fetch<{ images?: Array<{ asset?: { _ref?: string } }> } | null>(
      `*[_type == "catalogProduct" && _id == $id][0]{ images }`,
      { id: doc.catalogRef._ref }
    )
    if (catalog) {
      const current = catalog.images ?? []
      const ref = String(body.imageAssetId)
      if (!current.some((img) => img?.asset?._ref === ref)) {
        const newImages = [...current.map((img) => ({ _type: 'image' as const, asset: { _type: 'reference' as const, _ref: img!.asset!._ref } })), { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: ref } }]
        await writeClient.patch(doc.catalogRef._ref).set({ images: newImages }).commit()
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkProductOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
