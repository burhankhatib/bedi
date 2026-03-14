/**
 * Extract a focused search query from conversational user input.
 * E.g. "I feel like eating tenders, can you suggest any place?" → "tenders"
 * "Where can I get the best pizza?" → "pizza"
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
  'ممكن', 'أريد', 'أحتاج', 'اقترح', 'أفضل', 'أين', 'ما', 'كيف', 'هل',
])

/** Common food modifiers to keep with the main term (e.g. "chicken tenders"). */
const FOOD_PREFIXES = ['chicken', 'fish', 'beef', 'lamb', 'veggie', 'vegan', 'spicy', 'grilled', 'fried', 'baked']

/**
 * Extract 1–3 search terms from conversational query for product/business search.
 * Strips filler words, keeps food/product nouns and modifiers.
 */
export function extractSearchQuery(rawQuery: string): string {
  const q = (rawQuery ?? '').trim()
  if (!q) return ''

  const lowered = q.toLowerCase()
  const words = lowered
    .replace(/[?!.,;:'"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const kept: string[] = []
  let i = 0
  while (i < words.length) {
    const w = words[i]!
    const next = words[i + 1]
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
  return result || lowered.split(/\s+/).filter((w) => w.length > 2 && !FILLER_WORDS.has(w)).slice(0, 3).join(' ') || rawQuery.slice(0, 50)
}
