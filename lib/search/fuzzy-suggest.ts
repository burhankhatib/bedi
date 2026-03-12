/**
 * Fuzzy search and "did you mean" suggestions using Fuse.js.
 * Works with Arabic and English.
 */

import Fuse from 'fuse.js'
import { normalizeForSearch } from './normalize'

export interface SearchableItem {
  id: string
  /** Primary search text (e.g. product title, business name) */
  text: string
  /** Secondary text for search (e.g. description, alternate name) */
  textSecondary?: string
}

/**
 * Find the best fuzzy match from a list of searchable items.
 * Returns the suggested text if similarity is above threshold.
 */
export function suggestCorrection(
  query: string,
  items: SearchableItem[],
  options?: {
    threshold?: number // 0 = exact, 1 = match anything. Default 0.4 allows typos
    limit?: number
  }
): string | null {
  const q = query.trim()
  if (!q || items.length === 0) return null

  const threshold = options?.threshold ?? 0.45
  const limit = options?.limit ?? 5

  const fuse = new Fuse(items, {
    keys: ['text', 'textSecondary'],
    threshold,
    includeScore: true,
    getFn: (obj, path) => {
      const key = path as 'text' | 'textSecondary'
      const val = obj[key]
      return typeof val === 'string' ? normalizeForSearch(val) : ''
    },
    ignoreLocation: true,
  })

  const results = fuse.search(normalizeForSearch(q), { limit })
  if (results.length === 0) return null

  const best = results[0]
  if (!best || (best.score ?? 1) > threshold) return null

  return best.item.text
}

/**
 * Filter items with fuzzy search - returns items that match.
 */
export function fuzzySearch<T extends SearchableItem>(
  query: string,
  items: T[],
  options?: { threshold?: number; limit?: number }
): T[] {
  const q = query.trim()
  if (!q) return items

  const threshold = options?.threshold ?? 0.4
  const limit = options?.limit ?? 50

  const fuse = new Fuse(items, {
    keys: ['text', 'textSecondary'],
    threshold,
    includeScore: true,
    getFn: (obj, path) => {
      const key = path as 'text' | 'textSecondary'
      const val = obj[key]
      return typeof val === 'string' ? normalizeForSearch(val) : ''
    },
    ignoreLocation: true,
  })

  const results = fuse.search(normalizeForSearch(q), { limit })
  return results.map((r) => r.item)
}
