/**
 * Idempotently sync missing business sub-category documents for one business type.
 * Mirrors scripts/seed-business-subcategories.ts so CMS stays aligned with lib/business-subcategories-seed.
 */

import type { SanityClient } from 'next-sanity'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '@/lib/business-subcategories-seed'

export function missingSubcategoryRowsForType(
  businessType: string,
  existingSlugs: Set<string>
): Array<SubcategoryRow & { businessType: string }> {
  const rows = BY_BUSINESS_TYPE[businessType]
  if (!rows?.length) return []
  return rows
    .filter((r) => r.slug && !existingSlugs.has(r.slug))
    .map((r) => ({ ...r, businessType }))
}

export async function createOrReplaceSubcategoryDocs(
  writeClient: SanityClient,
  rows: Array<SubcategoryRow & { businessType: string }>
): Promise<void> {
  for (const row of rows) {
    const docId = `businessSubcategory.${row.slug}-${row.businessType}`
    await writeClient.createOrReplace({
      _id: docId,
      _type: 'businessSubcategory',
      slug: { _type: 'slug', current: row.slug },
      title_en: row.title_en,
      title_ar: row.title_ar,
      businessType: row.businessType,
      sortOrder: row.sortOrder,
    })
  }
}
