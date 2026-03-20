/**
 * Seed Business Sub-categories into Sanity
 *
 * Creates or updates Business sub-category (Specialty) documents.
 * Usage: npx tsx scripts/seed-business-subcategories.ts
 * Requires: SANITY_API_TOKEN in .env.local (with write access)
 *
 * For deployed apps: use POST /api/admin/seed-subcategories (super admin) instead —
 * that uses the app's Sanity project so data appears immediately.
 */

import path from 'path'
import { config } from 'dotenv'
import { createClient } from 'next-sanity'
import { apiVersion } from '../sanity/env'
import { BY_BUSINESS_TYPE, type SubcategoryRow } from '../lib/business-subcategories-seed'
import { createOrReplaceSubcategoryDocs } from '../lib/ensure-business-subcategories'

config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  const token = process.env.SANITY_API_TOKEN || process.env.SANITY_API
  if (!token) {
    console.error('❌ SANITY_API_TOKEN or SANITY_API must be set in .env.local')
    process.exit(1)
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production'
  if (!projectId) {
    console.error('❌ NEXT_PUBLIC_SANITY_PROJECT_ID must be set in .env.local')
    process.exit(1)
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  })

  const allRows: Array<SubcategoryRow & { businessType: string }> = []
  for (const [businessType, rows] of Object.entries(BY_BUSINESS_TYPE)) {
    for (const row of rows) {
      allRows.push({ ...row, businessType })
    }
  }

  console.log(`\n📦 Seeding ${allRows.length} business sub-categories (batched commits)...\n`)
  console.log(`   project=${projectId} dataset=${dataset}\n`)

  try {
    await createOrReplaceSubcategoryDocs(client, allRows)
    console.log(`\n✅ Done. Created/updated ${allRows.length} documents.\n`)
  } catch (e) {
    console.error('\n❌ Seed failed:', e)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
