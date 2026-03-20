import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getTenantBySlug } from '@/lib/tenant'
import { slugify, ensureUniqueSlug } from '@/lib/slugify'
import { uploadImageFromUrl, type ClientWithUpload } from '@/lib/sanity-upload'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function extractCategories(root: unknown): unknown[] | null {
  if (root == null || typeof root !== 'object') return null
  const o = root as Record<string, unknown>
  if (Array.isArray(o.categories)) return o.categories
  return null
}

function slugFromCategoryField(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (raw && typeof raw === 'object' && 'current' in raw) {
    const c = (raw as { current?: unknown }).current
    return typeof c === 'string' ? c.trim() : ''
  }
  return ''
}

function cleanStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out = raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((s) => s.trim())
  return out.length ? out : undefined
}

function cleanAddOns(raw: unknown): Array<{ name_en: string; name_ar: string; price: number }> | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: Array<{ name_en: string; name_ar: string; price: number }> = []
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue
    const r = a as Record<string, unknown>
    const name_en = String(r.name_en ?? '').trim()
    const name_ar = String(r.name_ar ?? '').trim()
    if (!name_en || !name_ar) continue
    out.push({ name_en, name_ar, price: Number(r.price ?? 0) })
  }
  return out.length ? out : undefined
}

function cleanVariants(raw: unknown): Array<{
  name_en: string
  name_ar: string
  required: boolean
  options: Array<Record<string, unknown>>
}> | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const groups: Array<{
    name_en: string
    name_ar: string
    required: boolean
    options: Array<Record<string, unknown>>
  }> = []
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue
    const gr = g as Record<string, unknown>
    const name_en = String(gr.name_en ?? '').trim()
    const name_ar = String(gr.name_ar ?? '').trim()
    if (!name_en || !name_ar) continue
    const optionsRaw = gr.options
    if (!Array.isArray(optionsRaw) || optionsRaw.length === 0) continue
    const options: Array<Record<string, unknown>> = []
    for (const opt of optionsRaw) {
      if (!opt || typeof opt !== 'object') continue
      const o = opt as Record<string, unknown>
      const label_en = String(o.label_en ?? '').trim()
      const label_ar = String(o.label_ar ?? '').trim()
      if (!label_en || !label_ar) continue
      const entry: Record<string, unknown> = {
        label_en,
        label_ar,
        priceModifier: o.priceModifier != null ? Number(o.priceModifier) : 0,
      }
      if (o.specialPriceModifier != null) entry.specialPriceModifier = Number(o.specialPriceModifier)
      if (o.specialPriceModifierExpires != null) entry.specialPriceModifierExpires = String(o.specialPriceModifierExpires)
      if (o.isDefault === true) entry.isDefault = true
      options.push(entry)
    }
    if (options.length === 0) continue
    groups.push({ name_en, name_ar, required: gr.required === true, options })
  }
  return groups.length ? groups : undefined
}

/**
 * POST: Super admin only. multipart/form-data: tenantSlug + file (.json), or JSON body: { tenantSlug, categories: [...] }.
 * Adds categories and products to the tenant (does not remove existing menu items).
 */
export async function POST(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    email = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) {
    return NextResponse.json({ error: 'SANITY_API_TOKEN required' }, { status: 500 })
  }

  const ct = req.headers.get('content-type') || ''
  let tenantSlug: string
  let parsed: unknown

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    tenantSlug = String(form.get('tenantSlug') ?? '').trim()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field (JSON upload)' }, { status: 400 })
    }
    const text = await file.text()
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return NextResponse.json({ error: 'File is not valid JSON' }, { status: 400 })
    }
  } else {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
    }
    const b = body as Record<string, unknown>
    tenantSlug = String(b.tenantSlug ?? '').trim()
    parsed = body
  }

  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 })
  }

  const tenant = await getTenantBySlug(tenantSlug, { useCdn: false })
  if (!tenant) {
    return NextResponse.json({ error: `No business found for slug: ${tenantSlug}` }, { status: 404 })
  }

  const siteId = tenant._id
  const categories = extractCategories(parsed)
  if (!categories || categories.length === 0) {
    return NextResponse.json(
      { error: 'JSON must include a non-empty "categories" array (same shape as menu export / InitialData.categories)' },
      { status: 400 }
    )
  }

  const results = {
    ok: true as boolean,
    tenantSlug,
    categoriesCreated: 0,
    productsCreated: 0,
    errors: [] as string[],
  }

  for (let ci = 0; ci < categories.length; ci++) {
    const catRaw = categories[ci]
    const catLabel = `Category ${ci + 1}`
    if (!catRaw || typeof catRaw !== 'object') {
      results.errors.push(`${catLabel}: invalid entry`)
      continue
    }
    const c = catRaw as Record<string, unknown>
    const title_en = String(c.title_en ?? '').trim()
    const title_ar = String(c.title_ar ?? '').trim()
    if (!title_en || !title_ar) {
      results.errors.push(`${catLabel}: title_en and title_ar are required`)
      continue
    }

    const slugHint = slugFromCategoryField(c.slug)
    const baseSlug = slugify(slugHint || title_en)
    const slugValue = await ensureUniqueSlug(baseSlug || 'category', async (s) => {
      const existing = await client.fetch<{ _id: string } | null>(
        `*[_type == "category" && site._ref == $siteId && slug.current == $slug][0]{ _id }`,
        { siteId, slug: s }
      )
      return !!existing
    })

    const sortOrder = c.sortOrder != null ? Number(c.sortOrder) : ci

    let categoryDoc
    try {
      categoryDoc = await writeClient.create({
        _type: 'category',
        site: { _type: 'reference', _ref: siteId },
        title_en,
        title_ar,
        slug: { _type: 'slug', current: slugValue },
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : ci,
      })
    } catch (e) {
      results.errors.push(`${catLabel} (“${title_en}”): ${(e as Error).message}`)
      continue
    }
    results.categoriesCreated++

    const products = Array.isArray(c.products) ? c.products : []
    for (let pi = 0; pi < products.length; pi++) {
      const prodRaw = products[pi]
      const pLabel = `Product ${pi + 1} in “${title_en}”`
      if (!prodRaw || typeof prodRaw !== 'object') {
        results.errors.push(`${pLabel}: invalid entry`)
        continue
      }
      const p = prodRaw as Record<string, unknown>
      const pt_en = String(p.title_en ?? '').trim()
      const pt_ar = String(p.title_ar ?? '').trim()
      if (!pt_en || !pt_ar) {
        results.errors.push(`${pLabel}: title_en and title_ar are required`)
        continue
      }
      if (p.price == null || Number.isNaN(Number(p.price))) {
        results.errors.push(`${pLabel}: price must be a number`)
        continue
      }

      let imageRef: string | null = null
      const imageUrl = p.imageUrl != null && typeof p.imageUrl === 'string' ? p.imageUrl.trim() : ''
      if (imageUrl) {
        imageRef = await uploadImageFromUrl(writeClient as ClientWithUpload, imageUrl)
      }

      const additionalRefs: string[] = []
      if (Array.isArray(p.additionalImageUrls)) {
        for (const u of p.additionalImageUrls) {
          if (typeof u !== 'string' || !u.trim()) continue
          const ref = await uploadImageFromUrl(writeClient as ClientWithUpload, u.trim())
          if (ref) additionalRefs.push(ref)
        }
      }

      const addOns = cleanAddOns(p.addOns)
      const variants = cleanVariants(p.variants)
      const ingredients_en = cleanStringArray(p.ingredients_en)
      const ingredients_ar = cleanStringArray(p.ingredients_ar)
      const dietaryTags = cleanStringArray(p.dietaryTags)

      const doc = {
        _type: 'product' as const,
        site: { _type: 'reference' as const, _ref: siteId },
        title_en: pt_en,
        title_ar: pt_ar,
        price: Number(p.price),
        currency: typeof p.currency === 'string' && p.currency.trim() ? p.currency.trim() : 'ILS',
        category: { _type: 'reference' as const, _ref: categoryDoc._id },
        sortOrder: p.sortOrder != null ? Number(p.sortOrder) : pi,
        isPopular: p.isPopular === true,
        isAvailable: p.isAvailable !== false,
        ...(p.description_en != null ? { description_en: String(p.description_en) } : {}),
        ...(p.description_ar != null ? { description_ar: String(p.description_ar) } : {}),
        ...(ingredients_en ? { ingredients_en } : {}),
        ...(ingredients_ar ? { ingredients_ar } : {}),
        ...(p.specialPrice != null && !Number.isNaN(Number(p.specialPrice))
          ? { specialPrice: Number(p.specialPrice) }
          : {}),
        ...(p.specialPriceExpires != null ? { specialPriceExpires: String(p.specialPriceExpires) } : {}),
        ...(p.saleUnit != null && typeof p.saleUnit === 'string' && p.saleUnit.trim()
          ? { saleUnit: p.saleUnit.trim() }
          : {}),
        ...(p.availableAgainAt != null ? { availableAgainAt: String(p.availableAgainAt) } : {}),
        ...(p.hidePrice === true ? { hidePrice: true } : {}),
        ...(dietaryTags ? { dietaryTags } : {}),
        ...(addOns ? { addOns } : {}),
        ...(variants ? { variants } : {}),
        ...(imageRef
          ? { image: { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: imageRef } } }
          : {}),
        ...(additionalRefs.length > 0
          ? {
              additionalImages: additionalRefs.map((_ref) => ({
                _type: 'image' as const,
                asset: { _type: 'reference' as const, _ref },
              })),
            }
          : {}),
      }

      try {
        await writeClient.create(doc)
        results.productsCreated++
      } catch (e) {
        results.errors.push(`${pLabel}: ${(e as Error).message}`)
      }
    }
  }

  results.ok = results.categoriesCreated > 0 || results.productsCreated > 0
  if (!results.ok && results.errors.length > 0) {
    return NextResponse.json(results, { status: 400 })
  }
  return NextResponse.json(results)
}
