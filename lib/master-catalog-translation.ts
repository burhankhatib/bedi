/**
 * Shared logic for master catalog translation needs.
 * Used by translate-products API and master-catalog list filter.
 */
const UNIT_TYPES = ['kg', 'piece', 'pack'] as const

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
 * Returns true if the Arabic text contains known transliteration mistakes
 * (English words written in Arabic script instead of proper Arabic).
 * E.g. "أحمد تي" has "تي" (tea) - should be "شاي أحمد".
 */
export function hasRuinedArabic(text: string | null | undefined): boolean {
  const s = typeof text === 'string' ? text.trim() : ''
  if (s.length < 2) return false
  const normalized = s.replace(/\s+/g, ' ')
  for (const pattern of RUINED_ARABIC_PATTERNS) {
    if (normalized.includes(pattern)) return true
  }
  return false
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

export function needsTranslation(p: {
  nameEn?: string | null
  nameAr?: string | null
  descriptionEn?: string | null
  descriptionAr?: string | null
  unitType?: string | null
}): boolean {
  const hasNameEn = typeof p.nameEn === 'string' && p.nameEn.trim().length > 0
  const hasNameAr = typeof p.nameAr === 'string' && p.nameAr.trim().length > 0
  const hasDescEn = typeof p.descriptionEn === 'string' && p.descriptionEn.trim().length > 0
  const hasDescAr = typeof p.descriptionAr === 'string' && p.descriptionAr.trim().length > 0
  const nameArRuined = hasEnglishInArabicField(p.nameAr) || hasRuinedArabic(p.nameAr)
  const descriptionArRuined = hasRuinedArabic(p.descriptionAr)
  const hasUnit = p.unitType && UNIT_TYPES.includes(p.unitType as (typeof UNIT_TYPES)[number])
  return !hasNameEn || !hasNameAr || !hasDescEn || !hasDescAr || !hasUnit || nameArRuined || descriptionArRuined
}
