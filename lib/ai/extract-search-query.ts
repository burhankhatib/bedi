/**
 * Keywords that indicate user wants a greengrocery (vegetables/fruits).
 * When present, we hint businessType greengrocer so RAG/tools find produce stores.
 */
const PRODUCE_KEYWORDS = new Set([
  'خضار', 'فواكه', 'فواكة', 'خضروات', 'فاكهة', 'خضره', 'فواكهه',
  'vegetables', 'fruits', 'vegetable', 'fruit', 'produce', 'greengrocery', 'greengrocer',
])

/**
 * Extract a focused search query from conversational user input.
 * E.g. "I feel like eating tenders, can you suggest any place?" → "tenders"
 * "Where can I get the best pizza?" → "pizza"
 * "محتاج خضار و فواكة" → "خضار فواكه" with produceIntent
 * Ensures search_products and RAG context find relevant results.
 */
const FILLER_WORDS = new Set([
  // English
  'i', 'me', 'my', 'want', 'feel', 'like', 'eating', 'craving', 'looking',
  'can', 'you', 'could', 'would', 'please', 'suggest', 'recommend', 'find',
  'any', 'some', 'place', 'places', 'restaurant', 'restaurants', 'store', 'stores',
  'shop', 'shops', 'cafe', 'cafes', 'market', 'markets', 'around', 'near',
  'here', 'nearby', 'town', 'city', 'area', 'the', 'a', 'an', 'for', 'to', 'in', 'at', 'that',
  'get', 'give', 'show', 'tell', 'help', 'need', 'have', 'had', 'has',
  'what', 'where', 'which', 'how', 'when', 'who', 'why',
  'best', 'good', 'nice', 'great', 'really', 'very', 'just', 'also',
  'and', 'or', 'but', 'if', 'so', 'with', 'from', 'about',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'did', 'does',
  // Arabic (common)
  'ممكن', 'أريد', 'أحتاج', 'اقترح', 'أفضل', 'أين', 'ما', 'كيف', 'هل', 'محتاج', 'و',
])

/** Common food modifiers to keep with the main term (e.g. "chicken tenders"). */
const FOOD_PREFIXES = ['chicken', 'fish', 'beef', 'lamb', 'veggie', 'vegan', 'spicy', 'grilled', 'fried', 'baked']

export type ExtractResult = {
  query: string
  /** When true, user wants produce/greengrocery (خضار/فواكه). Pass to search tools. */
  produceIntent?: boolean
}

/**
 * Extract 1–3 search terms from conversational query for product/business search.
 * Strips filler words, keeps food/product nouns and modifiers.
 * Detects produce intent (خضار، فواكه) for greengrocery routing.
 */
export function extractSearchQuery(rawQuery: string): string
export function extractSearchQuery(rawQuery: string, withIntent: true): ExtractResult
export function extractSearchQuery(rawQuery: string, withIntent?: boolean): string | ExtractResult {
  const q = (rawQuery ?? '').trim()
  if (!q) return withIntent ? { query: '', produceIntent: false } : ''

  const lowered = q.toLowerCase()
  const words = lowered
    .replace(/[?!.,;:'"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let produceIntent = false
  const kept: string[] = []
  let i = 0
  while (i < words.length) {
    const w = words[i]!
    const next = words[i + 1]
    if (PRODUCE_KEYWORDS.has(w)) produceIntent = true
    if (FILLER_WORDS.has(w)) {
      i++
      continue
    }
    // Keep food phrases like "chicken tenders", "fish and chips"
    if (FOOD_PREFIXES.includes(w) && next && !FILLER_WORDS.has(next)) {
      kept.push(`${w} ${next}`)
      i += 2
      continue
    }
    kept.push(w)
    i++
  }

  const result = kept.slice(0, 4).join(' ').trim()
  const finalQuery =
    result || lowered.split(/\s+/).filter((w) => w.length > 2 && !FILLER_WORDS.has(w)).slice(0, 3).join(' ') || rawQuery.slice(0, 50)

  if (produceIntent) {
    const hasProduceTerms = /خضار|فواك|vegetable|fruit|produce|greengroc/i.test(finalQuery)
    const withProduce = hasProduceTerms ? finalQuery : finalQuery ? `${finalQuery} خضار فواكه` : 'خضار فواكه'
    if (withIntent) return { query: withProduce, produceIntent: true }
    return withProduce
  }

  if (withIntent) return { query: finalQuery, produceIntent }
  return finalQuery
}
