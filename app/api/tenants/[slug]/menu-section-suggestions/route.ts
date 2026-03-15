import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getCommonMenuSections, getHierarchicalGrocerySections } from '@/lib/menu-sections'

/** GET: Suggested menu section names for this tenant. Returns common sections + subcategories matching tenant's businessType. For grocery/supermarket, returns hierarchical sectionGroups (select category → then show sub-categories). */
export const revalidate = 300

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tenant = await client.fetch<{ businessType?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ businessType }`,
    { tenantId: auth.tenantId }
  )
  const businessType = tenant?.businessType ?? 'restaurant'

  const isGroceryType = ['grocery', 'supermarket', 'greengrocer'].includes(businessType)
  const sectionGroups = isGroceryType ? getHierarchicalGrocerySections(businessType) : []

  const subcategories = await client.fetch<
    Array<{ _id: string; title_en?: string; title_ar?: string }>
  >(
    `*[_type == "businessSubcategory" && businessType == $businessType] | order(sortOrder asc, title_en asc) { _id, title_en, title_ar }`,
    { businessType }
  )

  const list = subcategories ?? []
  const subcatMap = new Map(list.map((s) => [(s.title_en ?? '').toLowerCase().trim(), s]))

  // For grocery with hierarchical sections, commonSections is empty (use sectionGroups). Otherwise remove duplicates.
  const allSectionsForType = getCommonMenuSections(businessType)
  const commonSections = isGroceryType && sectionGroups.length > 0
    ? []
    : allSectionsForType.filter((c) => !subcatMap.has((c.title_en ?? '').toLowerCase().trim()))

  return NextResponse.json({
    businessType,
    sectionGroups: sectionGroups.map((g) => ({
      key: g.key,
      title_en: g.title_en,
      title_ar: g.title_ar,
      subCategories: g.subCategories,
    })),
    subcategories: list.map((s) => ({
      _id: s._id,
      title_en: s.title_en ?? '',
      title_ar: s.title_ar ?? '',
    })),
    commonSections,
  })
}
