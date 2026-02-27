import slugifyLib from 'slugify'

const SLUG_MAX_LENGTH = 96

/**
 * Normalize a string into a URL-safe slug. Use this everywhere slugs are generated
 * so they are consistent and no two documents end up with the same slug when intended unique.
 */
export function slugify(input: string | null | undefined): string {
  if (input == null || typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''
  const slug = slugifyLib(trimmed, {
    lower: true,
    strict: true,
    locale: 'en',
  })
  return slug.slice(0, SLUG_MAX_LENGTH)
}

/**
 * Ensure a slug is unique by appending a short random suffix if the slug is already taken.
 * checkExists(slug) should return true if the slug is already used.
 */
export function ensureUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  return (async function trySlug(slug: string): Promise<string> {
    const exists = await checkExists(slug)
    if (!exists) return slug
    const suffix = Math.random().toString(36).slice(2, 8)
    const next = `${slug.slice(0, SLUG_MAX_LENGTH - 7)}-${suffix}`
    return trySlug(next)
  })(baseSlug)
}
