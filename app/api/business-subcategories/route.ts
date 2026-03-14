import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'

/** GET: List business sub-categories, optionally filtered by businessType. Used by onboarding and Studio. Uses CDN (reference data changes rarely). */
export const revalidate = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessType = searchParams.get('businessType') ?? ''

  const filter = businessType
    ? `_type == "businessSubcategory" && businessType == $businessType`
    : `_type == "businessSubcategory"`
  const params = businessType ? { businessType } : {}

  const list = await client.fetch<
    Array<{
      _id: string
      slug?: { current?: string }
      title_en?: string
      title_ar?: string
      businessType?: string
      sortOrder?: number
    }>
  >(
    `*[${filter}] | order(sortOrder asc, title_en asc) {
      _id,
      "slug": slug.current,
      title_en,
      title_ar,
      businessType,
      sortOrder
    }`,
    params
  )

  const items = (list ?? []).map((row) => ({
    _id: row._id,
    slug: typeof row.slug === 'string' ? row.slug : (row.slug as { current?: string })?.current ?? '',
    title_en: row.title_en ?? '',
    title_ar: row.title_ar ?? '',
    businessType: row.businessType ?? '',
    sortOrder: row.sortOrder ?? 0,
  }))

  return NextResponse.json(items)
}
