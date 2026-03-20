import { LUCIDE_ALL_KEYS_SORTED } from '@/lib/lucide-all-keys-sorted'

export const LUCIDE_ICON_KEY_SET = new Set<string>(LUCIDE_ALL_KEYS_SORTED)

/** Returns normalized kebab-case key or null if unknown to this Lucide version. */
export function normalizeLucideIconKey(raw: string | undefined | null): string | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  if (!s) return null
  if (LUCIDE_ICON_KEY_SET.has(s)) return s
  return null
}
