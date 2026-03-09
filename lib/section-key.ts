/**
 * Shared section/specialty key normalization so that:
 * - Sections API and Tenants API use the same key for matching (no "1 place" but empty results).
 * - Misspellings and plural/singular variants merge into one canonical key to avoid duplicates.
 */

export function normalizeSectionKey(s: string): string {
  const t = (s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
  return t
}

/**
 * Canonical key for grouping: same as normalizeSectionKey plus optional plural merge
 * so "Sandwiches" and "Sandwich" map to the same key. Used when building section lists.
 */
export function canonicalSectionKey(s: string): string {
  const key = normalizeSectionKey(s)
  if (!key) return key
  // Merge plural/singular: if key ends with 's' and is a single word, use base form for grouping
  const trimmed = key.trim()
  if (trimmed.length > 4 && /^[a-z0-9\s]+s$/.test(trimmed)) {
    const withoutS = trimmed.slice(0, -1)
    if (withoutS.length >= 3) return withoutS
  }
  return key
}
