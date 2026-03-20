import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { writeToken } from '@/sanity/lib/write-token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { slugify } from '@/lib/slugify'
import type { SanityClient } from 'next-sanity'
import { BUSINESS_TYPES } from '@/lib/constants'
import { defaultLucideKeyForSubcategory } from '@/lib/subcategory-default-lucide'
import { normalizeLucideIconKey } from '@/lib/lucide-icon-valid'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: writeToken || undefined, useCdn: false })

/** Seeded sub-categories use ids like `businessSubcategory.{slug}-{type}`; those docs are not returned by unauthenticated API reads. */
const readClient = clientNoCdn.withConfig({ token: writeToken || undefined, useCdn: false })

async function ensureBaselineBusinessCategories() {
  const existingValues = await readClient.fetch<string[]>(
    `array::unique(*[_type == "businessCategory" && defined(value) && value != ""].value)`
  )
  const existing = new Set((existingValues ?? []).map((v) => String(v).trim()).filter(Boolean))
  let tx = writeClient.transaction()
  let hasOps = false
  BUSINESS_TYPES.forEach((row, idx) => {
    if (existing.has(row.value)) return
    hasOps = true
    tx = tx.createIfNotExists({
      _id: `businessCategory.${row.value}`,
      _type: 'businessCategory',
      value: row.value,
      name_en: row.label,
      name_ar: row.labelAr,
      sortOrder: idx,
    })
  })
  if (hasOps) await tx.commit()
}

async function adminGate(): Promise<NextResponse | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    email = (sessionClaims?.email as string) || ''
  }
  if (!isSuperAdminEmail(email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!writeToken) {
    return NextResponse.json(
      { error: 'Server needs SANITY_API_TOKEN or SANITY_API_WRITE_TOKEN with write access.' },
      { status: 500 }
    )
  }
  return null
}

/** Machine id: lowercase, hyphens (matches schema regex). */
function businessTypeId(input: string): string {
  return slugify(input)
}

async function countTenantsByBusinessType(value: string): Promise<number> {
  const n = await readClient.fetch<number>(
    `count(*[_type == "tenant" && businessType == $v])`,
    { v: value }
  )
  return n ?? 0
}

async function stripSubcategoryFromAllTenants(
  w: SanityClient,
  subcategoryId: string
): Promise<number> {
  const tenants = await readClient.fetch<
    Array<{ _id: string; businessSubcategories?: Array<{ _ref: string; _key?: string; _type?: string }> }>
  >(`*[_type == "tenant" && references($sid)]{ _id, businessSubcategories }`, { sid: subcategoryId })

  let patches = 0
  const CHUNK = 35
  for (let i = 0; i < (tenants ?? []).length; i += CHUNK) {
    const slice = (tenants ?? []).slice(i, i + CHUNK)
    let tx = w.transaction()
    let has = false
    for (const t of slice) {
      const cur = t.businessSubcategories ?? []
      const refs = cur.filter((r) => r._ref !== subcategoryId)
      if (refs.length === cur.length) continue
      has = true
      patches++
      if (refs.length === 0) {
        tx = tx.patch(t._id, (p) => p.unset(['businessSubcategories']))
      } else {
        tx = tx.patch(t._id, (p) => p.set({ businessSubcategories: refs }))
      }
    }
    if (has) await tx.commit()
  }
  return patches
}

type CategoryRow = {
  _id: string
  value: string
  name_en: string
  name_ar: string
  sortOrder?: number
  imageAssetRef?: string | null
}

type SubRow = {
  _id: string
  slug: string
  title_en: string
  title_ar: string
  businessType: string
  sortOrder?: number
  lucideIcon?: string | null
}

/** GET: full taxonomy + tenant counts per businessType */
export async function GET() {
  const deny = await adminGate()
  if (deny) return deny
  await ensureBaselineBusinessCategories()

  const [categories, subcategories, tenantTypes] = await Promise.all([
    readClient.fetch<CategoryRow[]>(
      `*[_type == "businessCategory"] | order(sortOrder asc, name_en asc) {
        _id, value, name_en, name_ar, sortOrder,
        "imageAssetRef": image.asset._ref
      }`
    ),
    readClient.fetch<SubRow[]>(
      `*[_type == "businessSubcategory"] | order(businessType asc, sortOrder asc, title_en asc) {
        _id, "slug": slug.current, title_en, title_ar, businessType, sortOrder, lucideIcon
      }`
    ),
    readClient.fetch<string[]>(`*[_type == "tenant" && defined(businessType)].businessType`),
  ])

  const tenantCountByType: Record<string, number> = {}
  for (const bt of tenantTypes ?? []) {
    if (!bt) continue
    tenantCountByType[bt] = (tenantCountByType[bt] ?? 0) + 1
  }

  return NextResponse.json({
    categories: categories ?? [],
    subcategories: subcategories ?? [],
    tenantCountByType,
  })
}

/** POST: structured actions */
export async function POST(req: NextRequest) {
  const deny = await adminGate()
  if (deny) return deny

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''

  try {
    switch (action) {
      case 'createCategory': {
        const value = businessTypeId(String(body.value ?? ''))
        if (!value) return NextResponse.json({ error: 'value is required' }, { status: 400 })
        const name_en = String(body.name_en ?? '').trim()
        const name_ar = String(body.name_ar ?? '').trim()
        if (!name_en || !name_ar) {
          return NextResponse.json({ error: 'name_en and name_ar are required' }, { status: 400 })
        }
        const dup = await readClient.fetch<{ _id: string } | null>(
          `*[_type == "businessCategory" && value == $v][0]{ _id }`,
          { v: value }
        )
        if (dup) return NextResponse.json({ error: 'A category with this value already exists' }, { status: 409 })
        const topSo =
          (await readClient.fetch<number | null>(
            `*[_type == "businessCategory"] | order(sortOrder desc)[0].sortOrder`
          )) ?? -1
        const sortOrder =
          typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : topSo + 1

        const imageRef = typeof body.imageAssetRef === 'string' ? body.imageAssetRef.trim() : ''
        const created = await writeClient.create({
          _type: 'businessCategory',
          value,
          name_en,
          name_ar,
          sortOrder,
          ...(imageRef
            ? { image: { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: imageRef } } }
            : {}),
        })
        return NextResponse.json({ ok: true, id: created._id })
      }

      case 'updateCategory': {
        const id = String(body.id ?? '').trim()
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const existing = await readClient.fetch<CategoryRow | null>(
          `*[_type == "businessCategory" && _id == $id][0]{ _id, value, name_en, name_ar, sortOrder }`,
          { id }
        )
        if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

        const patch: Record<string, unknown> = {}
        if (body.name_en !== undefined) patch.name_en = String(body.name_en).trim()
        if (body.name_ar !== undefined) patch.name_ar = String(body.name_ar).trim()
        if (body.sortOrder !== undefined && typeof body.sortOrder === 'number') patch.sortOrder = body.sortOrder

        if (body.value !== undefined) {
          const nextVal = businessTypeId(String(body.value))
          if (!nextVal) return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
          if (nextVal !== existing.value) {
            const n = await countTenantsByBusinessType(existing.value)
            if (n > 0) {
              return NextResponse.json(
                {
                  error:
                    `Cannot change machine id (${existing.value}): ${n} business(es) still use it. Migrate them first or add a new category.`,
                  tenantCount: n,
                },
                { status: 400 }
              )
            }
            const dup = await readClient.fetch<{ _id: string } | null>(
              `*[_type == "businessCategory" && value == $v && _id != $id][0]{ _id }`,
              { v: nextVal, id }
            )
            if (dup) return NextResponse.json({ error: 'Another category uses this value' }, { status: 409 })
            patch.value = nextVal
          }
        }

        if (body.imageAssetRef !== undefined) {
          const ref = body.imageAssetRef === null ? '' : String(body.imageAssetRef).trim()
          if (!ref) {
            await writeClient.patch(id).unset(['image']).commit()
          } else {
            patch.image = { _type: 'image', asset: { _type: 'reference', _ref: ref } }
          }
        }

        if (Object.keys(patch).length > 0) {
          await writeClient.patch(id).set(patch).commit()
        }
        return NextResponse.json({ ok: true })
      }

      case 'deleteCategory': {
        const id = String(body.id ?? '').trim()
        const confirmValue = String(body.confirmValue ?? '').trim()
        if (!id || !confirmValue) {
          return NextResponse.json({ error: 'id and confirmValue (exact machine id) are required' }, { status: 400 })
        }
        const cat = await readClient.fetch<{ _id: string; value: string } | null>(
          `*[_type == "businessCategory" && _id == $id][0]{ _id, value }`,
          { id }
        )
        if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        if (cat.value !== confirmValue) {
          return NextResponse.json({ error: 'Confirmation must match the category machine id exactly' }, { status: 400 })
        }
        const n = await countTenantsByBusinessType(cat.value)
        if (n > 0) {
          return NextResponse.json(
            { error: `Remove or reassign ${n} business(es) using this type before deleting.`, tenantCount: n },
            { status: 400 }
          )
        }
        const subs = await readClient.fetch<string[]>(
          `*[_type == "businessSubcategory" && businessType == $v]._id`,
          { v: cat.value }
        )
        for (const subId of subs ?? []) {
          await stripSubcategoryFromAllTenants(writeClient, subId)
          await writeClient.delete(subId)
        }
        await writeClient.delete(id)
        return NextResponse.json({ ok: true, deletedSubcategories: (subs ?? []).length })
      }

      case 'createSubcategory': {
        const title_en = String(body.title_en ?? '').trim()
        const title_ar = String(body.title_ar ?? '').trim()
        const businessType = businessTypeId(String(body.businessType ?? ''))
        if (!title_en || !title_ar || !businessType) {
          return NextResponse.json({ error: 'title_en, title_ar, businessType are required' }, { status: 400 })
        }
        const catExists = await readClient.fetch<{ _id: string } | null>(
          `*[_type == "businessCategory" && value == $v][0]{ _id }`,
          { v: businessType }
        )
        if (!catExists) {
          return NextResponse.json(
            { error: `Add a Business Category with value "${businessType}" before creating subcategories.` },
            { status: 400 }
          )
        }
        let slug = slugify(String(body.slug ?? title_en))
        if (!slug) slug = slugify(title_en)
        if (!slug) return NextResponse.json({ error: 'Could not derive slug' }, { status: 400 })
        const docId = `businessSubcategory.${slug}-${businessType}`
        const exists = await readClient.fetch<{ _id: string } | null>(
          `*[_type == "businessSubcategory" && slug.current == $s && businessType == $bt][0]{ _id }`,
          { s: slug, bt: businessType }
        )
        if (exists) return NextResponse.json({ error: 'Sub-category slug already exists for this business type' }, { status: 409 })

        const maxSo =
          (await readClient.fetch<number | null>(
            `*[_type == "businessSubcategory" && businessType == $bt] | order(sortOrder desc)[0].sortOrder`,
            { bt: businessType }
          )) ?? -1
        const sortOrder =
          typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : maxSo + 1

        const iconRaw = typeof body.lucideIcon === 'string' ? body.lucideIcon.trim() : ''
        let lucideIcon = iconRaw ? normalizeLucideIconKey(iconRaw) : null
        if (iconRaw && !lucideIcon) {
          return NextResponse.json({ error: 'Invalid lucideIcon — use a kebab-case key from lucide.dev' }, { status: 400 })
        }
        if (!lucideIcon) {
          lucideIcon = defaultLucideKeyForSubcategory(businessType, slug)
        }
        const iconDup = await readClient.fetch<string | null>(
          `*[_type == "businessSubcategory" && lucideIcon == $icon][0]._id`,
          { icon: lucideIcon }
        )
        if (iconDup) {
          return NextResponse.json(
            { error: `Icon "${lucideIcon}" is already used by another sub-category. Pick a different icon.` },
            { status: 409 }
          )
        }

        await writeClient.createOrReplace({
          _id: docId,
          _type: 'businessSubcategory',
          slug: { _type: 'slug', current: slug },
          title_en,
          title_ar,
          businessType,
          sortOrder,
          lucideIcon,
        })
        return NextResponse.json({ ok: true, id: docId, slug })
      }

      case 'updateSubcategory': {
        const id = String(body.id ?? '').trim()
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const existing = await readClient.fetch<SubRow | null>(
          `*[_type == "businessSubcategory" && _id == $id][0]{ _id, "slug": slug.current, title_en, title_ar, businessType, sortOrder, lucideIcon }`,
          { id }
        )
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        /* Slug / business type are fixed after create (document id is tied to them). Delete + add new if you need to move. */
        if (body.slug !== undefined || body.businessType !== undefined) {
          return NextResponse.json(
            { error: 'Cannot change slug or business type on existing sub-category. Delete it and create a new one.' },
            { status: 400 }
          )
        }
        const patch: Record<string, unknown> = {}
        if (body.title_en !== undefined) patch.title_en = String(body.title_en).trim()
        if (body.title_ar !== undefined) patch.title_ar = String(body.title_ar).trim()
        if (body.sortOrder !== undefined && typeof body.sortOrder === 'number') patch.sortOrder = body.sortOrder
        if (body.lucideIcon !== undefined) {
          const raw = String(body.lucideIcon ?? '').trim()
          const nextIcon = raw
            ? normalizeLucideIconKey(raw)
            : defaultLucideKeyForSubcategory(String(existing.businessType ?? ''), String(existing.slug ?? ''))
          if (raw && !nextIcon) {
            return NextResponse.json(
              { error: 'Invalid lucideIcon — use a kebab-case key from lucide.dev' },
              { status: 400 }
            )
          }
          const iconDup = await readClient.fetch<string | null>(
            `*[_type == "businessSubcategory" && lucideIcon == $icon && _id != $eid][0]._id`,
            { icon: nextIcon, eid: id }
          )
          if (iconDup) {
            return NextResponse.json(
              { error: `Icon "${nextIcon}" is already used by another sub-category.` },
              { status: 409 }
            )
          }
          patch.lucideIcon = nextIcon
        }
        if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, id })
        await writeClient.patch(id).set(patch).commit()
        return NextResponse.json({ ok: true, id })
      }

      case 'deleteSubcategory': {
        const id = String(body.id ?? '').trim()
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const ex = await readClient.fetch<{ _id: string } | null>(
          `*[_type == "businessSubcategory" && _id == $id][0]{ _id }`,
          { id }
        )
        if (!ex) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const tenantsUpdated = await stripSubcategoryFromAllTenants(writeClient, id)
        await writeClient.delete(id)
        return NextResponse.json({ ok: true, tenantsUpdated })
      }

      case 'reorderCategories': {
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x) => typeof x === 'string') : []
        if (orderedIds.length === 0) return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
        let tx = writeClient.transaction()
        orderedIds.forEach((cid, i) => {
          tx = tx.patch(cid, (p) => p.set({ sortOrder: i }))
        })
        await tx.commit()
        return NextResponse.json({ ok: true })
      }

      case 'reorderSubcategories': {
        const businessType = businessTypeId(String(body.businessType ?? ''))
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x) => typeof x === 'string') : []
        if (!businessType || orderedIds.length === 0) {
          return NextResponse.json({ error: 'businessType and orderedIds required' }, { status: 400 })
        }
        let tx = writeClient.transaction()
        orderedIds.forEach((sid, i) => {
          tx = tx.patch(sid, (p) => p.set({ sortOrder: i, businessType }))
        })
        await tx.commit()
        return NextResponse.json({ ok: true })
      }

      case 'sortCategoriesAlphabetical': {
        const cats =
          (await readClient.fetch<CategoryRow[]>(
            `*[_type == "businessCategory"]{ _id, name_en, name_ar, value, sortOrder }`
          )) ?? []
        const sorted = [...cats].sort((a, b) =>
          (a.name_en || '').localeCompare(b.name_en || '', undefined, { sensitivity: 'base' })
        )
        let tx = writeClient.transaction()
        sorted.forEach((c, i) => {
          tx = tx.patch(c._id, (p) => p.set({ sortOrder: i }))
        })
        await tx.commit()
        return NextResponse.json({ ok: true, count: sorted.length })
      }

      case 'sortSubcategoriesAlphabetical': {
        const businessType = businessTypeId(String(body.businessType ?? ''))
        if (!businessType) return NextResponse.json({ error: 'businessType required' }, { status: 400 })
        const subs =
          (await readClient.fetch<SubRow[]>(
            `*[_type == "businessSubcategory" && businessType == $bt]{ _id, title_en, title_ar, slug, businessType, sortOrder }`,
            { bt: businessType }
          )) ?? []
        const sorted = [...subs].sort((a, b) =>
          (a.title_en || '').localeCompare(b.title_en || '', undefined, { sensitivity: 'base' })
        )
        let tx = writeClient.transaction()
        sorted.forEach((s, i) => {
          tx = tx.patch(s._id, (p) => p.set({ sortOrder: i }))
        })
        await tx.commit()
        return NextResponse.json({ ok: true, count: sorted.length })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e) {
    console.error('[admin/business-taxonomy]', action, e)
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
