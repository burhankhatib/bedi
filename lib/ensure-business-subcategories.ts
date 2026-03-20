/**
 * Idempotently sync missing business sub-category documents for one business type.
 * Mirrors scripts/seed-business-subcategories.ts so CMS stays aligned with lib/business-subcategories-seed.
 */

import type { SanityClient } from 'next-sanity'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '@/lib/business-subcategories-seed'

/** Sanity transactions should stay bounded; several commits still beat N sequential HTTP calls. */
const TRANSACTION_CHUNK = 55

export type SubcategoryListItem = {
  _id: string
  slug: string
  title_en: string
  title_ar: string
  businessType: string
  sortOrder: number
}

/**
 * Old Studio-created slugs → canonical seed slugs.
 * These were renamed during the seed migration; the mapping lets us merge them
 * in the dedup pass and resolve tenant refs to canonical IDs.
 */
const LEGACY_SLUG_MAP: Record<string, string> = {
  burger: 'burgers',
  broast: 'broasted',
  grill: 'grills',
  shawerma: 'shawarma',
  orientalsweets: 'oriental-sweets',
  homecook: 'home-cooked',
  gatea: 'gateau',
}

/** Normalise an old slug to its canonical seed slug (lowercase, mapped). */
export function canonicalSubcategorySlug(raw: string): string {
  const norm = raw.trim().toLowerCase()
  return LEGACY_SLUG_MAP[norm] ?? norm
}

export function missingSubcategoryRowsForType(
  businessType: string,
  existingSlugs: Set<string>
): Array<SubcategoryRow & { businessType: string }> {
  const rows = BY_BUSINESS_TYPE[businessType]
  if (!rows?.length) return []
  return rows
    .filter((r) => r.slug && !existingSlugs.has(r.slug.toLowerCase()))
    .map((r) => ({ ...r, businessType }))
}

export async function createOrReplaceSubcategoryDocs(
  writeClient: SanityClient,
  rows: Array<SubcategoryRow & { businessType: string }>
): Promise<void> {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += TRANSACTION_CHUNK) {
    const chunk = rows.slice(i, i + TRANSACTION_CHUNK)
    let tx = writeClient.transaction()
    for (const row of chunk) {
      const docId = `businessSubcategory.${row.slug}-${row.businessType}`
      tx = tx.createOrReplace({
        _id: docId,
        _type: 'businessSubcategory',
        slug: { _type: 'slug', current: row.slug },
        title_en: row.title_en,
        title_ar: row.title_ar,
        businessType: row.businessType,
        sortOrder: row.sortOrder,
      })
    }
    await tx.commit()
  }
}

/**
 * Legacy Studio docs sometimes duplicate the same slug as seeded `businessSubcategory.{slug}-{type}`.
 * Prefer the canonical seeded id so the list matches seed ordering/titles.
 * Also merges old-slug variants (e.g. "burger" → "burgers") via LEGACY_SLUG_MAP.
 */
export function dedupeSubcategoriesPreferSeeded(
  items: SubcategoryListItem[],
  businessType: string
): SubcategoryListItem[] {
  const bt = businessType.trim().toLowerCase()
  const noSlug: SubcategoryListItem[] = []
  const byCanonSlug = new Map<string, SubcategoryListItem[]>()

  for (const item of items) {
    const raw = (item.slug || '').trim().toLowerCase()
    if (!raw) {
      noSlug.push(item)
      continue
    }
    const canon = canonicalSubcategorySlug(raw)
    const list = byCanonSlug.get(canon) ?? []
    list.push(item)
    byCanonSlug.set(canon, list)
  }

  const merged: SubcategoryListItem[] = [...noSlug]
  for (const [canonSlug, group] of byCanonSlug.entries()) {
    if (group.length === 1) {
      merged.push(group[0])
      continue
    }
    const preferredId = `businessSubcategory.${canonSlug}-${bt}`
    const canonical = group.find((g) => g._id === preferredId)
    merged.push(
      canonical ?? group.slice().sort((a, b) => a._id.localeCompare(b._id))[0]
    )
  }

  merged.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return (a.title_en || '').localeCompare(b.title_en || '', undefined, { sensitivity: 'base' })
  })
  return merged
}
