import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { writeToken } from '@/sanity/lib/write-token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '@/lib/business-subcategories-seed'
import { createOrReplaceSubcategoryDocs } from '@/lib/ensure-business-subcategories'

const writeClient = client.withConfig({ token: writeToken || undefined, useCdn: false })

/** POST: Seed business sub-categories into Sanity. Uses the app's Sanity project/dataset. Super admin only. */
export async function POST() {
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
  if (!writeToken) {
    return NextResponse.json(
      {
        error:
          'Server needs SANITY_API_TOKEN or SANITY_API_WRITE_TOKEN (Editor access). Do not use read-only tokens.',
      },
      { status: 500 }
    )
  }

  const allRows: Array<SubcategoryRow & { businessType: string }> = []
  for (const [businessType, rows] of Object.entries(BY_BUSINESS_TYPE)) {
    for (const row of rows) {
      allRows.push({ ...row, businessType })
    }
  }

  try {
    await createOrReplaceSubcategoryDocs(writeClient, allRows)
  } catch (e) {
    console.error('[seed-subcategories] transaction failed:', e)
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'Sanity write failed. Use a token with Editor (write) access.',
        total: allRows.length,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    created: allRows.length,
    failed: 0,
    total: allRows.length,
    message: `Seeded ${allRows.length} subcategories. Refresh Business Profile to see them.`,
  })
}
