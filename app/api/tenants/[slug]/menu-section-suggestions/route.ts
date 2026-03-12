import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getCommonMenuSections } from '@/lib/menu-sections'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

/** GET: Suggested menu section names for this tenant. Returns common sections + subcategories matching tenant's businessType. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tenant = await freshClient.fetch<{ businessType?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ businessType }`,
    { tenantId: auth.tenantId }
  )
  const businessType = tenant?.businessType ?? 'restaurant'

  const subcategories = await freshClient.fetch<
    Array<{ _id: string; title_en?: string; title_ar?: string }>
  >(
    `*[_type == "businessSubcategory" && businessType == $businessType] | order(sortOrder asc, title_en asc) { _id, title_en, title_ar }`,
    { businessType }
  )

  const list = subcategories ?? []
  const subcatMap = new Map(list.map((s) => [(s.title_en ?? '').toLowerCase().trim(), s]))

  // Business-type-specific sections; remove any that duplicate a subcategory (by title_en, case-insensitive)
  const allSectionsForType = getCommonMenuSections(businessType)
  const commonSections = allSectionsForType.filter((c) => !subcatMap.has((c.title_en ?? '').toLowerCase().trim()))

  return NextResponse.json({
    businessType,
    subcategories: list.map((s) => ({
      _id: s._id,
      title_en: s.title_en ?? '',
      title_ar: s.title_ar ?? '',
    })),
    commonSections,
  })
}
