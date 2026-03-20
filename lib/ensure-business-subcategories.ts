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
 */
export function dedupeSubcategoriesPreferSeeded(
  items: SubcategoryListItem[],
  businessType: string
): SubcategoryListItem[] {
  const bt = businessType.trim().toLowerCase()
  const noSlug: SubcategoryListItem[] = []
  const byNormSlug = new Map<string, SubcategoryListItem[]>()

  for (const item of items) {
    const norm = (item.slug || '').trim().toLowerCase()
    if (!norm) {
      noSlug.push(item)
      continue
    }
    const list = byNormSlug.get(norm) ?? []
    list.push(item)
    byNormSlug.set(norm, list)
  }

  const merged: SubcategoryListItem[] = [...noSlug]
  for (const group of byNormSlug.values()) {
    if (group.length === 1) {
      merged.push(group[0])
      continue
    }
    const slug = group[0].slug
    const preferredId = `businessSubcategory.${slug}-${bt}`
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
