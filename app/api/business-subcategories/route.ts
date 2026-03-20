import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { writeToken } from '@/sanity/lib/write-token'
import {
  createOrReplaceSubcategoryDocs,
  dedupeSubcategoriesPreferSeeded,
  missingSubcategoryRowsForType,
} from '@/lib/ensure-business-subcategories'

const writeClient = client.withConfig({ token: writeToken || undefined, useCdn: false })

/**
 * Seeded docs use deterministic ids (`businessSubcategory.{slug}-{type}`). Those rows are not visible
 * to anonymous Sanity API requests — only the legacy UUID docs were returned (~14 items). Use the
 * same server token as writes so the full published list is available.
 */
const readClient = clientNoCdn.withConfig({ token: writeToken || undefined })

/** GET: List business sub-categories, optionally filtered by businessType. Bypasses CDN so newly seeded subcategories appear immediately. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function fetchSubcategoryRows(businessType: string) {
  const filter = businessType
    ? `_type == "businessSubcategory" && defined(businessType) && lower(businessType) == lower($businessType)`
    : `_type == "businessSubcategory"`
  const params = businessType ? { businessType } : {}

  const list = await readClient.fetch<
    Array<{
      _id: string
      slug?: { current?: string }
      title_en?: string
      title_ar?: string
      businessType?: string
      sortOrder?: number
      lucideIcon?: string
    }>
  >(
    `*[${filter}] | order(sortOrder asc, title_en asc) {
      _id,
      "slug": slug.current,
      title_en,
      title_ar,
      businessType,
      sortOrder,
      lucideIcon
    }`,
    params
  )

  return (list ?? []).map((row) => ({
    _id: row._id,
    slug: typeof row.slug === 'string' ? row.slug : (row.slug as { current?: string })?.current ?? '',
    title_en: row.title_en ?? '',
    title_ar: row.title_ar ?? '',
    businessType: row.businessType ?? '',
    sortOrder: row.sortOrder ?? 0,
    lucideIcon: row.lucideIcon ?? '',
  }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessType = searchParams.get('businessType') ?? ''

  let items = await fetchSubcategoryRows(businessType)

  /** Keep seed rows aligned in Sanity so new specialties appear without manual seeding. */
  const typeKey = businessType.trim().toLowerCase()
  if (typeKey && writeToken) {
    const existingSlugs = new Set(
      items.map((i) => (i.slug || '').trim().toLowerCase()).filter(Boolean)
    )
    const missing = missingSubcategoryRowsForType(typeKey, existingSlugs)
    if (missing.length > 0) {
      try {
        await createOrReplaceSubcategoryDocs(writeClient, missing)
        items = await fetchSubcategoryRows(businessType)
      } catch (e) {
        console.error('[business-subcategories] sync missing rows failed:', e)
      }
    }
  }

  if (businessType.trim()) {
    items = dedupeSubcategoriesPreferSeeded(items, businessType)
  }

  return NextResponse.json(items)
}
