import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { writeToken } from '@/sanity/lib/write-token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '@/lib/business-subcategories-seed'
import { createOrReplaceSubcategoryDocs, canonicalSubcategorySlug } from '@/lib/ensure-business-subcategories'

const writeClient = client.withConfig({ token: writeToken || undefined, useCdn: false })
const readClient = clientNoCdn.withConfig({ token: writeToken || undefined, useCdn: false })

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

/** PATCH: Migrate all tenant subcategory refs from old Studio IDs to canonical seeded IDs. Super admin only. */
export async function PATCH() {
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
    return NextResponse.json({ error: 'Server needs a write token' }, { status: 500 })
  }

  const tenants = await readClient.fetch<
    Array<{
      _id: string
      businessType?: string
      subs?: Array<{ _id: string; slug?: string; businessType?: string }> | null
    }>
  >(
    `*[_type == "tenant" && count(businessSubcategories) > 0]{
      _id, businessType,
      "subs": businessSubcategories[]->{ _id, "slug": slug.current, businessType }
    }`
  )

  let migrated = 0
  let skipped = 0
  for (const t of tenants) {
    const subs = (t.subs ?? []).filter(Boolean)
    if (subs.length === 0) { skipped++; continue }
    let changed = false
    const newRefs = subs.map((sub, i) => {
      if (!sub.slug || !sub.businessType) return { _type: 'reference' as const, _key: `sub-${i}`, _ref: sub._id }
      const canon = canonicalSubcategorySlug(sub.slug)
      const canonicalId = `businessSubcategory.${canon}-${sub.businessType.trim().toLowerCase()}`
      if (canonicalId !== sub._id) changed = true
      return { _type: 'reference' as const, _key: `sub-${i}`, _ref: canonicalId }
    })
    if (!changed) { skipped++; continue }
    try {
      await writeClient.patch(t._id).set({ businessSubcategories: newRefs }).commit()
      migrated++
    } catch (e) {
      console.error(`[migrate-subcats] tenant ${t._id} failed:`, e)
    }
  }

  return NextResponse.json({
    ok: true,
    migrated,
    skipped,
    total: tenants.length,
    message: `Migrated ${migrated} tenants to canonical subcategory IDs (${skipped} already up to date).`,
  })
}
