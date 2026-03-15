/**
 * Shared logic for master catalog translation needs.
 * Used by translate-products API and master-catalog list filter.
 */

/** Arabic Unicode range (letters, numbers, punctuation). */
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
/** Latin letters (English, etc.). */
const LATIN_REGEX = /[a-zA-Z]/

/**
 * Common wrong transliterations in Arabic (English words written in Arabic script).
 * Correct: تي→شاي, ميلك→حليب, رايس→أرز, طماطو→طماطم, etc.
 */
const RUINED_ARABIC_PATTERNS = [
  'تي', // tea (should be شاي) - e.g. أحمد تي → شاي أحمد
  'ميلك', // milk (should be حليب)
  'رايس', // rice (should be أرز)
  'طماطو', // wrong tomato (should be طماطم)
  'تشيز', // cheese (should be جبنة)
  'إيجز', // eggs (should be بيض)
  'ووتر', // water (should be ماء)
  'كوفي', // coffee (should be قهوة)
  'أورنج', // orange (should be برتقال)
  'أبول', // apple (should be تفاح)
  'سوب', // soup (should be شوربة)
  'بوتيتو', // potato (should be بطاطا)
  'أونين', // onion (should be بصل)
  'كيوكامبر', // cucumber (should be خيار)
  'سوسيدج', // sausage (should be سجق)
  'تشكن', // chicken (should be دجاج)
  'فيش', // fish (should be سمك)
  'مييت', // meat (should be لحم)
  'شوغر', // sugar (should be سكر)
  'فلور', // flour (should be طحين)
  'أويل', // oil (should be زيت)
  'جوس', // juice (should be عصير)
  'مغصوص', // wrong for mamoul (should be معمول)
]

/**
 * Patterns that must match as whole words (space/start/end boundaries only).
 * Avoids false positives: تي matches "أحمد تي" but NOT "التيراميسو" (tiramisu) or "لروتينك" (routine).
 */
const WORD_BOUNDARY_PATTERNS = ['تي']

/**
 * Returns true if the Arabic text contains known transliteration mistakes
 * (English words written in Arabic script instead of proper Arabic).
 * E.g. "أحمد تي" has "تي" (tea) - should be "شاي أحمد".
 */
export function hasRuinedArabic(text: string | null | undefined): boolean {
  const s = typeof text === 'string' ? text.trim() : ''
  if (s.length < 2) return false
  const normalized = s.replace(/\s+/g, ' ')
  for (const pattern of RUINED_ARABIC_PATTERNS) {
    if (WORD_BOUNDARY_PATTERNS.includes(pattern)) {
      const re = new RegExp(`(^|\\s)${escapeRegex(pattern)}(\\s|$)`)
      if (re.test(normalized)) return true
    } else if (normalized.includes(pattern)) {
      return true
    }
  }
  return false
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Returns true if the text appears to contain English/Latin when it should be Arabic.
 * E.g. "Tomatoes" in the nameAr field, or "Milk" - these should be translated to proper Arabic.
 */
export function hasEnglishInArabicField(text: string | null | undefined): boolean {
  const s = typeof text === 'string' ? text.trim() : ''
  if (s.length < 2) return false
  const hasLatin = LATIN_REGEX.test(s)
  const hasArabic = ARABIC_REGEX.test(s)
  // If it has Latin letters and few/no Arabic letters, treat as English
  if (hasLatin && !hasArabic) return true
  // If it has both but Latin dominates (e.g. "Tomatoes طماطم" - rare but possible)
  const arabicCount = (s.match(/[\u0600-\u06FF]/g) ?? []).length
  const latinCount = (s.match(/[a-zA-Z]/g) ?? []).length
  return hasLatin && latinCount > arabicCount
}

/**
 * Returns true if the product needs translation. Only flags products with:
 * 1. Missing Arabic translation (nameAr or descriptionAr)
 * 2. English text in the Arabic fields (nameAr or descriptionAr)
 * 3. Missing description (English and/or Arabic)
 *
 * Fully translated products (complete names, descriptions, proper Arabic) are NOT flagged.
 */
export function needsTranslation(p: {
  nameEn?: string | null
  nameAr?: string | null
  descriptionEn?: string | null
  descriptionAr?: string | null
  unitType?: string | null
}): boolean {
  const hasNameAr = typeof p.nameAr === 'string' && p.nameAr.trim().length > 0
  const hasDescEn = typeof p.descriptionEn === 'string' && p.descriptionEn.trim().length > 0
  const hasDescAr = typeof p.descriptionAr === 'string' && p.descriptionAr.trim().length > 0
  const nameArHasEnglish = hasEnglishInArabicField(p.nameAr) || hasRuinedArabic(p.nameAr)
  const descriptionArHasEnglish = hasEnglishInArabicField(p.descriptionAr) || hasRuinedArabic(p.descriptionAr)
  return (
    !hasNameAr ||
    !hasDescEn ||
    !hasDescAr ||
    nameArHasEnglish ||
    descriptionArHasEnglish
  )
}
