import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { MASTER_CATALOG_SEED } from '@/lib/master-catalog-seed'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Seed master catalog templates (super admin only). */
export async function POST(_req: NextRequest) {
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

  let createdCount = 0
  for (const item of MASTER_CATALOG_SEED) {
    const existing = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "masterCatalogProduct" && nameEn == $nameEn && category == $category][0]{ _id }`,
      { nameEn: item.nameEn, category: item.category }
    )
    if (existing) continue
    await writeClient.create({
      _type: 'masterCatalogProduct',
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      category: item.category,
      searchQuery: item.searchQuery,
      unitType: item.unitType,
    })
    createdCount++
  }

  return NextResponse.json({
    ok: true,
    productsCreated: createdCount,
  })
}

