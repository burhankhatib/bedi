import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { createOrReplaceSubcategoryDocs, missingSubcategoryRowsForType } from '@/lib/ensure-business-subcategories'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET: List business sub-categories, optionally filtered by businessType. Bypasses CDN so newly seeded subcategories appear immediately. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function fetchSubcategoryRows(businessType: string) {
  const filter = businessType
    ? `_type == "businessSubcategory" && defined(businessType) && lower(businessType) == lower($businessType)`
    : `_type == "businessSubcategory"`
  const params = businessType ? { businessType } : {}

  const list = await clientNoCdn.fetch<
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

  return (list ?? []).map((row) => ({
    _id: row._id,
    slug: typeof row.slug === 'string' ? row.slug : (row.slug as { current?: string })?.current ?? '',
    title_en: row.title_en ?? '',
    title_ar: row.title_ar ?? '',
    businessType: row.businessType ?? '',
    sortOrder: row.sortOrder ?? 0,
  }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessType = searchParams.get('businessType') ?? ''

  let items = await fetchSubcategoryRows(businessType)

  /** Logged-in users (onboarding / manage) trigger a one-time align with seed data so new cuisines exist in Sanity. */
  const typeKey = businessType.trim().toLowerCase()
  if (typeKey && token) {
    const { userId } = await auth()
    if (userId) {
      const existingSlugs = new Set(items.map((i) => i.slug).filter(Boolean))
      const missing = missingSubcategoryRowsForType(typeKey, existingSlugs)
      if (missing.length > 0) {
        try {
          await createOrReplaceSubcategoryDocs(writeClient, missing)
          items = await fetchSubcategoryRows(businessType)
        } catch (e) {
          console.error('[business-subcategories] sync missing rows:', e)
        }
      }
    }
  }

  return NextResponse.json(items)
}
