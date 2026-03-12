import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { CATALOG_CATEGORIES, CATALOG_PRODUCTS_BY_CATEGORY } from '@/lib/catalog-seed'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Seed catalog categories and products (Palestinian market). Super admin only. */
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
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "catalogCategory"][0]{ _id }`
  )
  if (existing) {
    return NextResponse.json({
      message: 'Catalog already seeded. Delete existing catalog categories and products in Studio first.',
    }, { status: 400 })
  }

  const categoryIds: Record<string, string> = {}
  for (const cat of CATALOG_CATEGORIES) {
    const created = await writeClient.create({
      _type: 'catalogCategory',
      title_en: cat.title_en,
      title_ar: cat.title_ar,
      slug: { _type: 'slug', current: cat.slug },
      sortOrder: cat.sortOrder,
    })
    categoryIds[cat.slug] = created._id
  }

  let productCount = 0
  for (const [catSlug, products] of Object.entries(CATALOG_PRODUCTS_BY_CATEGORY)) {
    const catId = categoryIds[catSlug]
    if (!catId) continue
    for (const p of products) {
      await writeClient.create({
        _type: 'catalogProduct',
        title_en: p.title_en,
        title_ar: p.title_ar,
        brand: p.brand,
        slug: { _type: 'slug', current: p.slug },
        category: { _type: 'reference', _ref: catId },
        defaultUnit: p.defaultUnit || 'piece',
        images: [],
        sortOrder: productCount,
      })
      productCount++
    }
  }

  return NextResponse.json({
    ok: true,
    categoriesCreated: CATALOG_CATEGORIES.length,
    productsCreated: productCount,
  })
}
