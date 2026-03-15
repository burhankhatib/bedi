/**
 * POST /api/admin/translate-products
 * Uses OpenAI to translate and fill missing fields in master catalog products.
 * Targets products missing one or more of: nameEn, nameAr, descriptionEn, descriptionAr, unitType.
 * Also translates when Arabic name contains English text.
 * Generates descriptions from title + Palestinian/Israeli market knowledge when missing.
 * Handles Hebrew product names: translates to both English and Arabic.
 * Body: { limit?: number, dryRun?: boolean, stream?: boolean }
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
import { needsTranslation, hasEnglishInArabicField, hasRuinedArabic } from '@/lib/master-catalog-translation'

const writeClient = clientNoCdn.withConfig({ token: token || undefined })

const BATCH_DELAY_MS = 400
const DEFAULT_LIMIT = 50

const TranslationSchema = z.object({
  nameEn: z.string().min(1).describe('Product name in English'),
  nameAr: z.string().min(1).describe('Product name in Arabic'),
  descriptionEn: z.string().min(1).describe('Short description in English, 1-2 sentences for Palestinian/Israeli market'),
  descriptionAr: z.string().min(1).describe('Short description in Arabic, 1-2 sentences for Palestinian/Israeli market'),
  unitType: z.enum(['kg', 'piece', 'pack']).describe('How sold: kg for produce/bulk, piece for items, pack for multi-packs'),
  searchQuery: z.string().nullable().describe('Unsplash search query for product image (2-4 words), or null if not applicable'),
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

  let body: { limit?: number; skip?: number; dryRun?: boolean; stream?: boolean } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* empty body ok */
  }
  const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), 500)
  const skip = Math.max(0, body.skip ?? 0)
  const dryRun = body.dryRun === true
  const stream = body.stream === true

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

  const needingWork = (products ?? []).filter(needsTranslation)
  const totalNeedingWork = needingWork.length
  const toProcess = needingWork.slice(skip, skip + limit)
  const results: { _id: string; ok: boolean; error?: string; updated?: string[]; nameEn?: string; nameAr?: string }[] = []

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const processProduct = async (
    p: (typeof toProcess)[0]
  ): Promise<{ ok: boolean; error?: string; updated?: string[]; nameEn?: string; nameAr?: string }> => {
    const titleEn = (p.nameEn ?? '').trim()
    const titleAr = (p.nameAr ?? '').trim()
    const descEn = (p.descriptionEn ?? '').trim()
    const descAr = (p.descriptionAr ?? '').trim()
    const category = p.category ?? 'grocery'
    const existingUnit = p.unitType
    const productDisplay = titleEn || titleAr || 'Unknown'
    const arabicNeedsFix = hasEnglishInArabicField(titleAr) || hasRuinedArabic(titleAr)

    const prompt = `You are helping fill a product catalog for a Palestinian/Israeli food delivery platform.
Product name(s): ${productDisplay}
English name: ${titleEn || '(missing)'}
Arabic name: ${titleAr || '(missing)'}${arabicNeedsFix ? ' [NOTE: Contains errors - use correct Levantine Arabic]' : ''}
Category: ${category}
Current unit: ${existingUnit || '(missing)'}
English description: ${descEn || '(missing)'}
Arabic description: ${descAr || '(missing)'}

MANDATORY: Use LEVANTINE ARABIC (لهجة بلاد الشام) — the dialect used in Palestine, Jordan, and Syria.

REGIONAL FOOD TERMS (English = Levantine Arabic — use these EXACT spellings):
- Mamoul = معمول (date-filled pastry, NOT مغصوص or any other)
- Labaneh / Labneh = لبنة
- Zaatar = زعتر
- Hummus = حمص
- Tabouleh / Tabbouleh = تبولة
- Knafeh / Kunafa = كنافة
- Falafel = فلافل
- Baklava = بقلاوة
- Shawarma = شاورما
- Sfeeha = صفيحة
- Fatayer = فطائر
- Manakish = مناقيش
- Sambousek = سمبوسك
- Mujaddara = مجدرة
- Maqluba = مقلوبة
- Musakhan = مسخن
- Mansaf = منسف
- Shawerma = شاورما
- Kanafeh = كنافة

COMMON PRODUCTS (Levantine spelling):
Tea=شاي, Milk=حليب, Rice=أرز, Tomato=طماطم, Bread=خبز, Cheese=جبنة, Eggs=بيض, Oil=زيت, Sugar=سكر, Salt=ملح, Pasta=معكرونة, Coffee=قهوة, Water=ماء, Flour=طحين, Cucumber=خيار, Potato=بطاطا, Onion=بصل, Lettuce=خس, Lemon=ليمون, Orange=برتقال, Apple=تفاح, Banana=موز.

Brand + product order: [product] [brand]. "Ahmad Tea" = شاي أحمد. "Tnuva Milk" = حليب تنوفا.

CRITICAL: If the English word IS the regional term (Mamoul, Labaneh, Zaatar, etc.), use the correct Levantine spelling. Do NOT invent wrong translations. Check what Palestinians/Jordanians/Syrians actually say and write.

Tasks:
1. TRANSLATE: Provide nameEn and nameAr using Levantine Arabic (لهجة بلاد الشام). Use regional terms from the list above. Never transliterate—use real Arabic.
2. DESCRIBE: 1-2 sentences, Palestinian/Jordanian/Syrian market context.
3. UNIT: kg/piece/pack.
4. SEARCH: Unsplash query if useful.

Output: nameEn, nameAr, descriptionEn, descriptionAr, unitType, searchQuery.`

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TranslationSchema,
      system: `Expert Levantine Arabic (لهجة بلاد الشام) catalog editor for Palestine, Jordan, Syria. Use regional spellings: Mamoul=معمول (NOT مغصوص), Labaneh=لبنة, Zaatar=زعتر, Hummus=حمص, Knafeh=كنافة. When English IS the regional term, use correct Levantine spelling. Brand+product: شاي أحمد. No transliteration. No invented words. Output valid JSON only.`,
      prompt,
    })

    if (dryRun) {
      return { ok: true, updated: ['dry run - no changes'], nameEn: object.nameEn, nameAr: object.nameAr }
    }

    const patch: Record<string, unknown> = {}
    const missingNameEn = !titleEn
    const missingNameAr = !titleAr || arabicNeedsFix
    const missingDescEn = !descEn
    const descArRuined = hasRuinedArabic(descAr)
    const missingDescAr = !descAr || descArRuined

    if (missingNameEn && object.nameEn) patch.nameEn = object.nameEn
    if (missingNameAr && object.nameAr) patch.nameAr = object.nameAr
    if (missingDescEn && object.descriptionEn) patch.descriptionEn = object.descriptionEn
    if (missingDescAr && object.descriptionAr) patch.descriptionAr = object.descriptionAr
    if (!existingUnit && object.unitType) patch.unitType = object.unitType
    const hasSearch = typeof p.searchQuery === 'string' && p.searchQuery.trim().length >= 2
    if (!hasSearch && object.searchQuery && object.searchQuery.length >= 2) patch.searchQuery = object.searchQuery

    const updatedFields = Object.keys(patch)
    if (updatedFields.length === 0) {
      return { ok: true, updated: ['no changes needed'], nameEn: object.nameEn, nameAr: object.nameAr }
    }

    await writeClient.patch(p._id).set(patch).commit()
    return { ok: true, updated: updatedFields, nameEn: object.nameEn, nameAr: object.nameAr }
  }

  if (stream && !dryRun) {
    const encoder = new TextEncoder()
    const streamResults: { ok: boolean; updated?: string[] }[] = []
    const streamResponse = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < toProcess.length; i++) {
          const p = toProcess[i]
          let lastError: string | undefined
          let r: Awaited<ReturnType<typeof processProduct>> | null = null
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) await sleep(2000)
              r = await processProduct(p)
              break
            } catch (err) {
              lastError = err instanceof Error ? err.message : 'Unknown'
              if (attempt === 0 && (lastError.includes('rate') || lastError.includes('429') || lastError.includes('overloaded'))) continue
              break
            }
          }
          const result = r ?? { ok: false, error: lastError }
          streamResults.push(result)
          const payload = JSON.stringify({
            type: 'product',
            index: i + 1,
            total: toProcess.length,
            _id: p._id,
            nameEn: p.nameEn,
            nameAr: p.nameAr,
            ok: result.ok,
            error: result.error,
            updated: result.updated,
            translatedNameEn: result.nameEn,
            translatedNameAr: result.nameAr,
          }) + '\n'
          controller.enqueue(encoder.encode(payload))
          if (i < toProcess.length - 1) await sleep(BATCH_DELAY_MS)
        }
        const translated = streamResults.filter((r) => r.ok && r.updated?.length && !['no changes needed', 'dry run - no changes'].includes(r.updated[0]!)).length
        const skipped = streamResults.filter((r) => r.ok && r.updated?.[0] && ['no changes needed', 'dry run - no changes'].includes(r.updated[0])).length
        const failed = streamResults.filter((r) => !r.ok).length
        const remaining = Math.max(0, totalNeedingWork - skip - toProcess.length)
        const summary = JSON.stringify({
          type: 'done',
          ok: failed === 0,
          totalNeedingWork,
          processed: toProcess.length,
          translated,
          skipped,
          failed,
          remaining,
        }) + '\n'
        controller.enqueue(encoder.encode(summary))
        controller.close()
      },
    })
    return new Response(streamResponse, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
    })
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
        if (attempt === 0 && (lastError.includes('rate') || lastError.includes('429') || lastError.includes('overloaded'))) continue
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
  const remaining = Math.max(0, totalNeedingWork - skip - toProcess.length)

  const errorSamples = results.filter((r) => !r.ok && r.error).slice(0, 3).map((r) => r.error!)

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
