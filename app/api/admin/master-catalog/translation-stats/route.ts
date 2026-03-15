import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { needsTranslation } from '@/lib/master-catalog-translation'

export const dynamic = 'force-dynamic'

/** GET: Translation stats for master catalog (super admin only). */
export async function GET() {
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

  const products = await clientNoCdn.fetch<
    Array<{
      nameEn?: string | null
      nameAr?: string | null
      descriptionEn?: string | null
      descriptionAr?: string | null
      unitType?: string | null
    }>
  >(
    `*[_type == "masterCatalogProduct"][0...10000]{ nameEn, nameAr, descriptionEn, descriptionAr, unitType }`
  )
  const total = (products ?? []).length
  const needingWork = (products ?? []).filter(needsTranslation).length
  const translated = total - needingWork

  return NextResponse.json(
    { total, needingWork, translated },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
