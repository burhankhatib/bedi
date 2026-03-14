/**
 * POST /api/admin/translate-products
 * Uses OpenAI to translate and fill missing fields in master catalog products.
 * Targets products missing one or more of: nameEn, nameAr, descriptionEn, descriptionAr, unitType.
 * Generates descriptions from title + Palestinian/Israeli market knowledge when missing.
 * Handles Hebrew product names: translates to both English and Arabic.
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

const BATCH_DELAY_MS = 400
const DEFAULT_LIMIT = 50

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
  const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), 100)
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

  const totalNeedingWork = (products ?? []).filter(needsTranslation).length
  const toProcess = (products ?? []).filter(needsTranslation).slice(0, limit)
  const results: { _id: string; ok: boolean; error?: string; updated?: string[] }[] = []

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const processProduct = async (
    p: (typeof toProcess)[0]
  ): Promise<{ ok: boolean; error?: string; updated?: string[] }> => {
    const titleEn = (p.nameEn ?? '').trim()
    const titleAr = (p.nameAr ?? '').trim()
    const descEn = (p.descriptionEn ?? '').trim()
    const descAr = (p.descriptionAr ?? '').trim()
    const category = p.category ?? 'grocery'
    const existingUnit = p.unitType
    const productDisplay = titleEn || titleAr || 'Unknown'

    const prompt = `You are helping fill a product catalog for a Palestinian/Israeli food delivery platform.
Product name(s): ${productDisplay}
English name: ${titleEn || '(missing)'}
Arabic name: ${titleAr || '(missing)'}
Category: ${category}
Current unit: ${existingUnit || '(missing)'}
English description: ${descEn || '(missing)'}
Arabic description: ${descAr || '(missing)'}

IMPORTANT: Product names may be in English, Arabic, or Hebrew. If the name is in Hebrew, translate it to BOTH proper English and Arabic using terminology common in Palestinian/Israeli markets (e.g. גבנה → Labaneh / لبنة).

Tasks:
1. TRANSLATE: If only one name exists, translate to the other. If name is Hebrew, provide both English and Arabic. If both exist, keep them.
2. DESCRIBE: If description is missing, write a SHORT (1-2 sentences) description. Use product name + knowledge of Palestinian/Israeli markets (Tnuva, Osem, Strauss, Bamba, local produce, traditional foods like hummus, labaneh, zaatar).
3. UNIT: Infer unitType: "kg" for produce/bulk (tomatoes, flour, rice), "piece" for single items (eggs, milk, bread, cheese), "pack" for multi-packs (6-pack soda, box of 12).
4. SEARCH: Suggest Unsplash query (2-4 words) for product image if useful.

Output: nameEn, nameAr, descriptionEn, descriptionAr, unitType, searchQuery (optional). All required fields must be non-empty strings.`

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TranslationSchema,
      system: `You are a bilingual catalog editor for Palestinian/Israeli markets. Output only valid JSON. Use proper Arabic script. Keep descriptions concise (max 2 sentences). Never return empty strings for nameEn, nameAr, descriptionEn, or descriptionAr.`,
      prompt,
    })

    if (dryRun) {
      return { ok: true, updated: ['dry run - no changes'] }
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
      return { ok: true, updated: ['no changes needed'] }
    }

    await writeClient.patch(p._id).set(patch).commit()
    return { ok: true, updated: updatedFields }
  }

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]
    let lastError: string | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await sleep(2000)
        const r = await processProduct(p)
        results.push({ _id: p._id, ...r })
        break
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error'
        if (attempt === 0 && (lastError.includes('rate') || lastError.includes('429') || lastError.includes('overloaded'))) {
          continue
        }
        results.push({ _id: p._id, ok: false, error: lastError })
        console.error('[admin translate-products]', p._id, err)
        break
      }
    }
    if (i < toProcess.length - 1) await sleep(BATCH_DELAY_MS)
  }

  const translated = results.filter((r) => r.ok && r.updated && r.updated.length > 0 && r.updated[0] !== 'no changes needed' && r.updated[0] !== 'dry run - no changes').length
  const skipped = results.filter((r) => r.ok && r.updated && (r.updated[0] === 'no changes needed' || r.updated[0] === 'dry run - no changes')).length
  const failed = results.filter((r) => !r.ok).length
  const remaining = Math.max(0, totalNeedingWork - toProcess.length)

  const errorSamples = results
    .filter((r) => !r.ok && r.error)
    .slice(0, 3)
    .map((r) => r.error)

  return NextResponse.json({
    ok: failed === 0,
    message: dryRun
      ? `Dry run: would process ${toProcess.length} products`
      : failed === 0
        ? `Translated ${translated}, skipped ${skipped}. ${remaining} remaining.`
        : `Translated ${translated}, skipped ${skipped}, failed ${failed}. ${remaining} remaining.`,
    totalNeedingWork,
    processed: toProcess.length,
    translated,
    skipped,
    failed,
    remaining,
    errorSamples: errorSamples.length > 0 ? errorSamples : undefined,
    dryRun,
    results,
  })
}
