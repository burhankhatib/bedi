/**
 * Detect if user query is a question (→ AI mode) vs keywords (→ direct search).
 * Kept simple to avoid false positives.
 */
const QUESTION_PATTERNS_EN = [
  /\bwhat\b/i,
  /\bhow\b/i,
  /\bwhich\b/i,
  /\bbest\b/i,
  /\brecipe\b/i,
  /\breceipt\b/i,
  /\brecommend\b/i,
  /\bsuggest\b/i,
  /\btell\s+me\b/i,
  /\bfind\s+me\b/i,
  /\bget\s+me\b/i,
  /\bi\s+want\b/i,
  /\bshow\s+me\b/i,
  /\bfeel\s+like\b/i,
  /\bcraving\b/i,
  /\blooking\s+for\b/i,
  /\bin\s+the\s+mood\s+for\b/i,
]
const QUESTION_PATTERNS_AR = [
  /ما\s*(هو|هي|أفضل|أحسن)/,
  /كيف/,
  /أفضل/,
  /أحسن/,
  /وصفة/,
  /وصفات/,
  /اقترح/,
  /أنصح/,
  /أريد/,
  /أعطني/,
]

const AFFIRMATIVE_FOLLOWUPS = /^(yes|yeah|yep|please|نعم|أيوه|ايه)[\s!.,?]*$/i

export function isLikelyQuestion(query: string): boolean {
  const q = (query ?? '').trim()
  if (q.length < 2) return false
  // Ends with ?
  if (q.endsWith('?')) return true
  // Short affirmatives (e.g. "Yes" to "Reply Yes to search for ingredients")
  if (AFFIRMATIVE_FOLLOWUPS.test(q)) return true
  const lowered = q.toLowerCase()
  const hasEnPattern = QUESTION_PATTERNS_EN.some((p) => p.test(lowered))
  const hasArPattern = QUESTION_PATTERNS_AR.some((p) => p.test(q))
  return hasEnPattern || hasArPattern
}
