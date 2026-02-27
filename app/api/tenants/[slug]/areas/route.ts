import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET areas for a tenant. Public (no auth) so customers can load delivery areas on the menu page. Uses no-CDN so customers always see the latest areas. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug, { useCdn: false })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const list = await clientNoCdn.fetch<
    Array<{
      _id: string
      name_en: string
      name_ar: string
      deliveryPrice: number
      currency: string
      isActive: boolean
      sortOrder?: number
      estimatedTime?: number
    }>
  >(
    `*[_type == "area" && site._ref == $siteId && isActive == true] | order(sortOrder asc, name_en asc) { _id, name_en, name_ar, deliveryPrice, currency, isActive, sortOrder, estimatedTime }`,
    { siteId: tenant._id }
  )
  return NextResponse.json(list || [])
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
  const { name_en, name_ar, deliveryPrice, currency, isActive, sortOrder } = body as {
    name_en?: string
    name_ar?: string
    deliveryPrice?: number
    currency?: string
    isActive?: boolean
    sortOrder?: number
  }
  const nameEn = (name_en ?? '').trim()
  const nameAr = (name_ar ?? '').trim()
  if (!nameEn || !nameAr) {
    return NextResponse.json({ error: 'name_en and name_ar required' }, { status: 400 })
  }

  // Dedupe: if this tenant already has an area with the same names, return it (and optionally update price/settings) so we keep only one
  const existingList = await writeClient.fetch<
    Array<{ _id: string; name_en: string; name_ar: string; deliveryPrice: number; currency: string; isActive: boolean; sortOrder?: number }>
  >(
    `*[_type == "area" && site._ref == $siteId] { _id, name_en, name_ar, deliveryPrice, currency, isActive, sortOrder }`,
    { siteId: auth.tenantId }
  )
  const normalized = (s: string) => (s ?? '').trim().toLowerCase()
  const existing = existingList?.find(
    (a) => normalized(a.name_en) === normalized(nameEn) && (a.name_ar ?? '').trim() === nameAr
  )
  if (existing) {
    const updates: { deliveryPrice?: number; currency?: string; isActive?: boolean; sortOrder?: number } = {}
    if (deliveryPrice != null) updates.deliveryPrice = Number(deliveryPrice)
    if (currency != null) updates.currency = currency
    if (typeof isActive === 'boolean') updates.isActive = isActive
    if (sortOrder != null) updates.sortOrder = sortOrder
    if (Object.keys(updates).length > 0) {
      await writeClient.patch(existing._id).set(updates).commit()
    }
    return NextResponse.json({
      _id: existing._id,
      name_en: existing.name_en,
      name_ar: existing.name_ar,
      deliveryPrice: updates.deliveryPrice ?? existing.deliveryPrice,
      currency: updates.currency ?? existing.currency,
      isActive: updates.isActive ?? existing.isActive,
      sortOrder: updates.sortOrder ?? existing.sortOrder,
    })
  }

  const doc = await writeClient.create({
    _type: 'area',
    site: { _type: 'reference', _ref: auth.tenantId },
    name_en: nameEn,
    name_ar: nameAr,
    deliveryPrice: deliveryPrice != null ? Number(deliveryPrice) : 0,
    currency: currency || 'ILS',
    isActive: isActive !== false,
    sortOrder: sortOrder ?? 0,
  })
  return NextResponse.json({
    _id: doc._id,
    name_en: doc.name_en,
    name_ar: doc.name_ar,
    deliveryPrice: doc.deliveryPrice,
    currency: doc.currency,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
  })
}
