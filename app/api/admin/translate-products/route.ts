/**
 * POST /api/admin/translate-products
 * Uses OpenAI to translate and fill missing fields in master catalog products.
 * Targets products missing one or more of: nameEn, nameAr, descriptionEn, descriptionAr, unitType.
 * Generates descriptions from title + Palestinian/Israeli market knowledge when missing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = clientNoCdn.withConfig({ token: token || undefined })

const CATEGORIES = ['restaurant', 'cafe', 'bakery', 'grocery', 'retail', 'pharmacy', 'other'] as const
const UNIT_TYPES = ['kg', 'piece', 'pack'] as const

const TranslationSchema = z.object({
  nameEn: z.string().min(1).describe('Product name in English'),
  nameAr: z.string().min(1).describe('Product name in Arabic'),
  descriptionEn: z.string().min(1).describe('Short description in English, 1-2 sentences for Palestinian/Israeli market'),
  descriptionAr: z.string().min(1).describe('Short description in Arabic, 1-2 sentences for Palestinian/Israeli market'),
  unitType: z.enum(['kg', 'piece', 'pack']).describe('How sold: kg for produce/bulk, piece for items, pack for multi-packs'),
  searchQuery: z.string().min(2).optional().describe('Unsplash search query for product image'),
})

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

function needsTranslation(p: {
  nameEn?: string | null
  nameAr?: string | null
  descriptionEn?: string | null
  descriptionAr?: string | null
  unitType?: string | null
}) {
  const hasNameEn = typeof p.nameEn === 'string' && p.nameEn.trim().length > 0
  const hasNameAr = typeof p.nameAr === 'string' && p.nameAr.trim().length > 0
  const hasDescEn = typeof p.descriptionEn === 'string' && p.descriptionEn.trim().length > 0
  const hasDescAr = typeof p.descriptionAr === 'string' && p.descriptionAr.trim().length > 0
  const hasUnit = p.unitType && UNIT_TYPES.includes(p.unitType as (typeof UNIT_TYPES)[number])
  return !hasNameEn || !hasNameAr || !hasDescEn || !hasDescAr || !hasUnit
}

export async function POST(req: NextRequest) {
  const authResult = await checkSuperAdmin()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: authResult.status }
    )
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  let body: { limit?: number; dryRun?: boolean } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* empty body ok */
  }
  const limit = Math.min(Math.max(0, body.limit ?? 500), 500)
  const dryRun = body.dryRun === true

  const products = await clientNoCdn.fetch<
    Array<{
      _id: string
      nameEn?: string | null
      nameAr?: string | null
      descriptionEn?: string | null
      descriptionAr?: string | null
      category?: string | null
      unitType?: string | null
      searchQuery?: string | null
    }>
  >(
    `*[_type == "masterCatalogProduct"] | order(nameEn asc) {
      _id, nameEn, nameAr, descriptionEn, descriptionAr, category, unitType, searchQuery
    }`
  )

  const toProcess = (products ?? []).filter(needsTranslation).slice(0, limit)
  const results: { _id: string; ok: boolean; error?: string; updated?: string[] }[] = []

  for (const p of toProcess) {
    try {
      const titleEn = (p.nameEn ?? '').trim()
      const titleAr = (p.nameAr ?? '').trim()
      const descEn = (p.descriptionEn ?? '').trim()
      const descAr = (p.descriptionAr ?? '').trim()
      const category = p.category ?? 'grocery'
      const existingUnit = p.unitType

      const prompt = `You are helping fill a product catalog for a Palestinian/Israeli food delivery platform.
Product: ${titleEn || titleAr || 'Unknown'}
English name: ${titleEn || '(missing)'}
Arabic name: ${titleAr || '(missing)'}
Category: ${category}
Current unit: ${existingUnit || '(missing)'}
English description: ${descEn || '(missing)'}
Arabic description: ${descAr || '(missing)'}

Tasks:
1. TRANSLATE: If only one name exists, translate to the other. If both exist, keep them.
2. DESCRIBE: If description is missing, write a SHORT (1-2 sentences) description. Use product name + knowledge of Palestinian/Israeli markets (Tnuva, Osem, Strauss, Bamba, local produce, traditional foods like hummus, labaneh, zaatar).
3. UNIT: Infer unitType: "kg" for produce/bulk (tomatoes, flour, rice), "piece" for single items (eggs, milk, bread, cheese), "pack" for multi-packs (6-pack soda, box of 12).
4. SEARCH: Suggest Unsplash query (2-4 words) for product image if useful.

Output: nameEn, nameAr, descriptionEn, descriptionAr, unitType, searchQuery (optional).`

      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: TranslationSchema,
        system: `You are a bilingual catalog editor for Palestinian/Israeli markets. Output only valid JSON. Use proper Arabic script. Keep descriptions concise (max 2 sentences).`,
        prompt,
      })

      if (dryRun) {
        results.push({ _id: p._id, ok: true, updated: ['dry run - no changes'] })
        continue
      }

      const patch: Record<string, unknown> = {}
      if (!titleEn && object.nameEn) patch.nameEn = object.nameEn
      if (!titleAr && object.nameAr) patch.nameAr = object.nameAr
      if (!descEn && object.descriptionEn) patch.descriptionEn = object.descriptionEn
      if (!descAr && object.descriptionAr) patch.descriptionAr = object.descriptionAr
      if (!existingUnit && object.unitType) patch.unitType = object.unitType
      const hasSearch = typeof p.searchQuery === 'string' && p.searchQuery.trim().length >= 2
      if (!hasSearch && object.searchQuery && object.searchQuery.length >= 2) patch.searchQuery = object.searchQuery

      const updatedFields = Object.keys(patch)
      if (updatedFields.length === 0) {
        results.push({ _id: p._id, ok: true, updated: ['no changes needed'] })
        continue
      }

      await writeClient.patch(p._id).set(patch).commit()
      results.push({ _id: p._id, ok: true, updated: updatedFields })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ _id: p._id, ok: false, error: msg })
      console.error('[admin translate-products]', p._id, err)
    }
  }

  const okCount = results.filter((r) => r.ok).length
  const errCount = results.filter((r) => !r.ok).length

  return NextResponse.json({
    ok: errCount === 0,
    message: dryRun
      ? `Dry run: would process ${toProcess.length} products`
      : `Processed ${toProcess.length} products: ${okCount} updated, ${errCount} failed`,
    totalNeedingWork: (products ?? []).filter(needsTranslation).length,
    processed: toProcess.length,
    updated: okCount,
    failed: errCount,
    dryRun,
    results,
  })
}
