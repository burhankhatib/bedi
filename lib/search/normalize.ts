/**
 * Search text normalization for Arabic and English.
 * Handles diacritics, alef/teh variations, and whitespace for consistent matching.
 */

/** Normalize Arabic: remove diacritics, unify alef variants (ا أ إ آ), teh marbuta. */
export function normalizeArabic(s: string): string {
  if (!s || typeof s !== 'string') return ''
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritics
      .replace(/[أإآٱ]/g, 'ا') // Unify alef forms
      .replace(/ة/g, 'ه') // Teh marbuta → heh for search
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  )
}

/** Normalize English/Latin: lowercase, collapse whitespace. */
export function normalizeLatin(s: string): string {
  if (!s || typeof s !== 'string') return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Check if string is predominantly Arabic (RTL script). */
export function isArabicScript(s: string): boolean {
  if (!s || typeof s !== 'string') return false
  const arabicRegex = /[\u0600-\u06FF]/
  const arabicCount = (s.match(arabicRegex) ?? []).length
  const latinCount = (s.match(/[a-zA-Z]/g) ?? []).length
  return arabicCount >= latinCount
}

/** Normalize for search: applies appropriate normalization based on script. */
export function normalizeForSearch(s: string): string {
  if (!s || typeof s !== 'string') return ''
  const trimmed = s.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return isArabicScript(trimmed) ? normalizeArabic(trimmed) : normalizeLatin(trimmed)
}
