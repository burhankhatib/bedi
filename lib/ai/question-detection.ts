/**
 * Detect if user query is a question (→ AI mode) vs keywords (→ direct search).
 * Lenient: understand intent even without "?" — treat conversational queries as questions.
 */
const QUESTION_PATTERNS_EN = [
  /\bwhat\b/i,
  /\bhow\b/i,
  /\bwhich\b/i,
  /\bwhere\b/i,
  /\bwhen\b/i,
  /\bwhy\b/i,
  /\bwho\b/i,
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
  /\bcan\s+you\b/i,
  /\bcould\s+you\b/i,
  /\bdo\s+you\s+have\b/i,
  /\bis\s+there\b/i,
  /\bare\s+there\b/i,
  /\bany\s+(good|place|restaurant|store)\b/i,
  /\bnear\s+me\b/i,
  /\baround\s+here\b/i,
  /\bavailable\b/i,
  /\boptions?\b/i,
]
const QUESTION_PATTERNS_AR = [
  /ما\s*(هو|هي|أفضل|أحسن)/,
  /كيف/,
  /أين/,
  /متى/,
  /لماذا/,
  /أفضل/,
  /أحسن/,
  /وصفة/,
  /وصفات/,
  /اقترح/,
  /أنصح/,
  /أريد/,
  /أعطني/,
  /هل\s+يوجد/,
  /ممكن/,
]

const AFFIRMATIVE_FOLLOWUPS = /^(yes|yeah|yep|please|نعم|أيوه|ايه)[\s!.,?]*$/i

export function isLikelyQuestion(query: string): boolean {
  const q = (query ?? '').trim()
  if (q.length < 2) return false
  // Ends with ? — always a question
  if (q.endsWith('?')) return true
  // Short affirmatives (e.g. "Yes" to reply)
  if (AFFIRMATIVE_FOLLOWUPS.test(q)) return true
  const lowered = q.toLowerCase()
  const hasEnPattern = QUESTION_PATTERNS_EN.some((p) => p.test(lowered))
  const hasArPattern = QUESTION_PATTERNS_AR.some((p) => p.test(q))
  return hasEnPattern || hasArPattern
}
