import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST /api/admin/fix-catalog-product-images
 *
 * One-time (idempotent) migration: finds every tenant product that has both
 * `catalogRef` set AND `image` set where the image asset ref matches the
 * catalog's first image — meaning the image was auto-copied at import time
 * rather than uploaded by the tenant.
 *
 * Clearing the `image` field lets the menu GROQ
 *   coalesce(image, catalogRef->images[0], masterCatalogRef->image)
 * fall through to the live catalog image, so Super Admin updates propagate
 * automatically.
 *
 * Products where the tenant uploaded a custom image (different asset ref)
 * are left untouched.
 */
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

  // Find all products with catalogRef + image where the image ref matches the
  // catalog's first image ref (auto-copied snapshot).
  const staleProducts: { _id: string; imageRef: string; catalogFirstImageRef: string | null }[] =
    await writeClient.fetch(
      `*[_type == "product" && defined(catalogRef) && defined(image.asset._ref)] {
        _id,
        "imageRef": image.asset._ref,
        "catalogFirstImageRef": catalogRef->images[0].asset._ref
      }`,
      {},
      { cache: 'no-store' }
    )

  const toFix = staleProducts.filter(
    (p) => p.catalogFirstImageRef && p.imageRef === p.catalogFirstImageRef
  )

  if (toFix.length === 0) {
    return NextResponse.json({ fixed: 0, message: 'All catalog-linked products are already clean.' })
  }

  // Unset image in a transaction so it's atomic.
  const tx = writeClient.transaction()
  for (const product of toFix) {
    tx.patch(product._id, (p) => p.unset(['image']))
  }
  await tx.commit()

  return NextResponse.json({
    fixed: toFix.length,
    ids: toFix.map((p) => p._id),
    message: `Cleared auto-copied catalog image from ${toFix.length} product(s). They now resolve images live from the global catalog.`,
  })
}
