import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/** Variant group and add-on shapes used across products (for suggestions) */
type VariantOption = { label_en?: string; label_ar?: string; priceModifier?: number }
type VariantGroup = { name_en: string; name_ar: string; options: VariantOption[] }
type AddOn = { name_en: string; name_ar: string; price: number }

const key = (s: string) => (s || '').trim().toLowerCase()

/**
 * GET: Suggest variant groups and add-ons from this tenant's existing products.
 * Used to quick-add the same group/add-on to another product. Each product keeps its own copy;
 * editing one product never changes others.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const list = await client.fetch<Array<{ variants?: VariantGroup[]; addOns?: AddOn[] }>>(
    `*[_type == "product" && site._ref == $siteId]{ variants, addOns }`,
    { siteId: auth.tenantId }
  )

  const variantMap = new Map<string, VariantGroup>()
  for (const p of list || []) {
    const groups = Array.isArray(p.variants) ? p.variants : []
    for (const g of groups) {
      const nameEn = (g.name_en || '').trim()
      if (!nameEn) continue
      const k = key(nameEn)
      const existing = variantMap.get(k)
      const opts = Array.isArray(g.options) ? g.options.filter((o) => (o.label_en || o.label_ar || '').trim()) : []
      if (!existing || (opts.length > (existing.options?.length ?? 0))) {
        variantMap.set(k, {
          name_en: nameEn,
          name_ar: (g.name_ar || '').trim() || nameEn,
          options: opts.length ? opts.map((o) => ({
            label_en: (o.label_en || '').trim() || (o.label_ar || ''),
            label_ar: (o.label_ar || '').trim() || (o.label_en || ''),
            priceModifier: typeof o.priceModifier === 'number' ? o.priceModifier : 0,
          })) : [{ label_en: '', label_ar: '', priceModifier: 0 }],
        })
      }
    }
  }

  const addOnMap = new Map<string, AddOn>()
  for (const p of list || []) {
    const addOns = Array.isArray(p.addOns) ? p.addOns : []
    for (const a of addOns) {
      const nameEn = (a.name_en || '').trim()
      if (!nameEn) continue
      const k = key(nameEn)
      if (!addOnMap.has(k)) {
        addOnMap.set(k, {
          name_en: nameEn,
          name_ar: (a.name_ar || '').trim() || nameEn,
          price: typeof a.price === 'number' ? a.price : 0,
        })
      }
    }
  }

  return NextResponse.json({
    variantGroups: Array.from(variantMap.values()),
    addOns: Array.from(addOnMap.values()),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
