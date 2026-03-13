import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { urlFor } from '@/sanity/lib/image'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = clientNoCdn.withConfig({ token: token || undefined })

const CATEGORIES = ['restaurant', 'cafe', 'bakery', 'grocery', 'retail', 'pharmacy', 'other'] as const

async function checkSuperAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false as const, status: 401 }
  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    email = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(email)) return { ok: false as const, status: 403 }
  if (!token) return { ok: false as const, status: 500 }
  return { ok: true as const }
}

/**
 * PATCH: Update a master catalog product (super admin only).
 * Body: { nameEn?, nameAr?, descriptionEn?, descriptionAr?, category?, unitType?, searchQuery?, imageAssetId? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
  }

  let body: {
    nameEn?: string
    nameAr?: string
    descriptionEn?: string
    descriptionAr?: string
    category?: string
    unitType?: string
    searchQuery?: string
    imageAssetId?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.nameEn === 'string') patch.nameEn = body.nameEn.trim()
  if (typeof body.nameAr === 'string') patch.nameAr = body.nameAr.trim()
  if (typeof body.descriptionEn === 'string') patch.descriptionEn = body.descriptionEn.trim() || undefined
  if (typeof body.descriptionAr === 'string') patch.descriptionAr = body.descriptionAr.trim() || undefined
  if (typeof body.category === 'string' && CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])) {
    patch.category = body.category.trim()
  }
  if (typeof body.unitType === 'string' && ['kg', 'piece', 'pack'].includes(body.unitType)) {
    patch.unitType = body.unitType
  }
  if (typeof body.searchQuery === 'string') patch.searchQuery = body.searchQuery.trim() || undefined

  if (body.imageAssetId === null || body.imageAssetId === '') {
    patch.image = null // Signal to unset
  } else if (typeof body.imageAssetId === 'string' && body.imageAssetId.trim()) {
    patch.image = { _type: 'image', asset: { _type: 'reference', _ref: body.imageAssetId.trim() } }
  }

  const hasImageChange = 'image' in patch
  const hasOtherChanges = Object.keys(patch).filter((k) => k !== 'image').length > 0

  if (!hasImageChange && !hasOtherChanges) {
    return NextResponse.json({ ok: true, message: 'No changes' })
  }

  try {
    const p = writeClient.patch(id)
    if (hasImageChange && patch.image === null) {
      p.unset(['image'])
    }
    const setPatch = { ...patch }
    if (setPatch.image === null) delete setPatch.image
    if (Object.keys(setPatch).length > 0) {
      p.set(setPatch)
    }
    await p.commit()

    const updated = await clientNoCdn.fetch<{
      _id: string
      nameEn?: string
      nameAr?: string
      descriptionEn?: string
      descriptionAr?: string
      category?: string
      searchQuery?: string
      unitType?: string
      image?: { asset?: { _ref?: string } }
    }>(
      `*[_id == $id][0]{ _id, nameEn, nameAr, descriptionEn, descriptionAr, category, searchQuery, unitType, "image": image }`,
      { id }
    )
    const imageRef = updated?.image?.asset?._ref
    const imageUrl = imageRef ? urlFor({ _type: 'image', asset: { _ref: imageRef } }).width(200).height(200).url() : null
    const product = updated
      ? {
          _id: updated._id,
          nameEn: updated.nameEn,
          nameAr: updated.nameAr,
          descriptionEn: updated.descriptionEn,
          descriptionAr: updated.descriptionAr,
          category: updated.category,
          searchQuery: updated.searchQuery,
          unitType: updated.unitType,
          imageUrl,
        }
      : null

    return NextResponse.json({ ok: true, message: 'Product updated', product })
  } catch (err) {
    console.error('[admin master-catalog] patch error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to update'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
