import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '@/lib/business-subcategories-seed'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Seed business sub-categories into Sanity. Uses the app's Sanity project/dataset. Super admin only. */
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

  const allRows: Array<SubcategoryRow & { businessType: string }> = []
  for (const [businessType, rows] of Object.entries(BY_BUSINESS_TYPE)) {
    for (const row of rows) {
      allRows.push({ ...row, businessType })
    }
  }

  let success = 0
  let failed = 0

  for (const row of allRows) {
    const docId = `businessSubcategory.${row.slug}-${row.businessType}`
    try {
      await writeClient.createOrReplace({
        _id: docId,
        _type: 'businessSubcategory',
        slug: { _type: 'slug', current: row.slug },
        title_en: row.title_en,
        title_ar: row.title_ar,
        businessType: row.businessType,
        sortOrder: row.sortOrder,
      })
      success++
    } catch (e) {
      failed++
      console.error(`[seed-subcategories] ${row.slug} (${row.businessType}):`, e)
    }
  }

  return NextResponse.json({
    ok: true,
    created: success,
    failed,
    total: allRows.length,
    message: `Seeded ${success} subcategories. Failed: ${failed}. Refresh /manage/business to see them.`,
  })
}
