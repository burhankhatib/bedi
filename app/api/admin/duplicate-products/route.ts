/**
 * Admin API for finding and resolving duplicate master catalog products.
 * GET: Find duplicates by normalized name + category.
 * POST: Merge (keep one, merge others, update refs, delete) or Delete (remove one, clear refs).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = clientNoCdn.withConfig({ token: token || undefined, useCdn: false })

type MasterProduct = {
  _id: string
  nameEn?: string | null
  nameAr?: string | null
  descriptionEn?: string | null
  descriptionAr?: string | null
  category?: string | null
  searchQuery?: string | null
  unitType?: string | null
  image?: { asset?: { _ref?: string } } | null
}

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

/** Normalize for duplicate detection: lowercase, trim, collapse spaces, remove diacritics/arabic tatweel */
function normalizeKey(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\u0640/g, '') // Arabic tatweel
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

/** Build duplicate key: normalized name (prefer En) + category */
function getDuplicateKey(p: { nameEn?: string | null; nameAr?: string | null; category?: string | null }): string {
  const name = (p.nameEn || p.nameAr || '').trim()
  const cat = (p.category || 'other').trim().toLowerCase()
  return `${normalizeKey(name)}|${cat}`
}

/**
 * GET: Find duplicate groups.
 * Returns { groups: Array<{ key, products: MasterProduct[] }> }
 */
export async function GET() {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  const products = await clientNoCdn.fetch<MasterProduct[]>(
    `*[_type == "masterCatalogProduct"] | order(nameEn asc) {
      _id, nameEn, nameAr, descriptionEn, descriptionAr, category, searchQuery, unitType,
      "image": image
    }`
  )

  const byKey = new Map<string, MasterProduct[]>()
  for (const p of products ?? []) {
    const key = getDuplicateKey(p)
    const list = byKey.get(key) ?? []
    list.push(p)
    byKey.set(key, list)
  }

  const groups = Array.from(byKey.entries())
    .filter(([, list]) => list.length >= 2)
    .map(([key, list]) => ({
      key,
      products: list.map((p) => {
        const imageRef = p.image?.asset?._ref
        const imageUrl = imageRef ? urlFor({ _type: 'image', asset: { _ref: imageRef } }).width(200).height(200).url() : null
        return {
          _id: p._id,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          descriptionEn: p.descriptionEn,
          descriptionAr: p.descriptionAr,
          category: p.category,
          searchQuery: p.searchQuery,
          unitType: p.unitType,
          imageUrl,
        }
      }),
    }))
    .sort((a, b) => b.products.length - a.products.length)

  return NextResponse.json({
    ok: true,
    groups,
    totalDuplicates: groups.reduce((s, g) => s + g.products.length, 0),
  })
}

/**
 * POST: Merge or delete duplicates.
 * Body: { action: 'merge', keepId, mergeIds } | { action: 'delete', id }
 */
export async function POST(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  let body: { action?: string; keepId?: string; mergeIds?: string[]; id?: string }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action === 'merge') {
    const keepId = typeof body.keepId === 'string' ? body.keepId.trim() : ''
    const mergeIds = Array.isArray(body.mergeIds)
      ? body.mergeIds.map((s) => String(s).trim()).filter(Boolean)
      : []
    if (!keepId || mergeIds.length === 0) {
      return NextResponse.json({ error: 'merge requires keepId and mergeIds' }, { status: 400 })
    }
    if (mergeIds.includes(keepId)) {
      return NextResponse.json({ error: 'keepId must not be in mergeIds' }, { status: 400 })
    }

    const all = await writeClient.fetch<MasterProduct[]>(
      `*[_type == "masterCatalogProduct" && _id in $ids]{ _id, nameEn, nameAr, descriptionEn, descriptionAr, category, searchQuery, unitType, "image": image }`,
      { ids: [keepId, ...mergeIds] }
    )
    const kept = all?.find((p) => p._id === keepId)
    if (!kept) return NextResponse.json({ error: 'Keep product not found' }, { status: 404 })
    const toMerge = all?.filter((p) => mergeIds.includes(p._id)) ?? []

    // Merge best fields into kept: take first non-empty
    const patch: Record<string, unknown> = {}
    for (const p of [kept, ...toMerge]) {
      if (p.nameEn?.trim() && !patch.nameEn) patch.nameEn = p.nameEn.trim()
      if (p.nameAr?.trim() && !patch.nameAr) patch.nameAr = p.nameAr.trim()
      if (p.descriptionEn?.trim() && !patch.descriptionEn) patch.descriptionEn = p.descriptionEn.trim()
      if (p.descriptionAr?.trim() && !patch.descriptionAr) patch.descriptionAr = p.descriptionAr.trim()
      if (p.searchQuery?.trim() && !patch.searchQuery) patch.searchQuery = p.searchQuery.trim()
      if (p.unitType && !patch.unitType) patch.unitType = p.unitType
      if (p.image?.asset?._ref && !(patch.image as { asset?: { _ref?: string } })?.asset?._ref) {
        patch.image = { _type: 'image', asset: { _type: 'reference', _ref: p.image.asset._ref } }
      }
    }

    if (Object.keys(patch).length > 0) {
      await writeClient.patch(keepId).set(patch).commit()
    }

    // Update product.masterCatalogRef: any ref to merged ids → keepId
    for (const oldId of mergeIds) {
      const refs = await writeClient.fetch<{ _id: string }[]>(
        `*[_type == "product" && masterCatalogRef._ref == $ref]{ _id }`,
        { ref: oldId }
      )
      for (const r of refs ?? []) {
        await writeClient.patch(r._id).set({ masterCatalogRef: { _type: 'reference', _ref: keepId } }).commit()
      }
    }

    // Delete merged products
    for (const oldId of mergeIds) {
      await writeClient.delete(oldId)
    }

    return NextResponse.json({
      ok: true,
      message: `Merged ${mergeIds.length} product(s) into ${keepId}`,
      keepId,
      mergedCount: mergeIds.length,
    })
  }

  if (body.action === 'delete') {
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'delete requires id' }, { status: 400 })

    const exists = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "masterCatalogProduct" && _id == $id][0]{ _id }`,
      { id }
    )
    if (!exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Clear masterCatalogRef on products that reference this
    const refs = await writeClient.fetch<{ _id: string }[]>(
      `*[_type == "product" && masterCatalogRef._ref == $ref]{ _id }`,
      { ref: id }
    )
    for (const r of refs ?? []) {
      await writeClient.patch(r._id).unset(['masterCatalogRef']).commit()
    }

    await writeClient.delete(id)
    return NextResponse.json({
      ok: true,
      message: `Deleted product. Cleared ${refs?.length ?? 0} tenant product references.`,
      clearedRefs: refs?.length ?? 0,
    })
  }

  return NextResponse.json({ error: 'Unknown action. Use merge or delete.' }, { status: 400 })
}
