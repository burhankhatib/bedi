/**
 * Normalize social profile input (username or full URL) into a working profile URL.
 * Works for: username only (e.g. "burhanstudio") or full URL (e.g. "https://www.instagram.com/burhanstudio").
 */

const IS_URL = /^https?:\/\//i

function trimAndExtractUsername(input: string): string {
  return input.trim().replace(/^@+|\/+$/g, '')
}

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'snapchat' | 'website'

/**
 * Returns the canonical profile URL for the given platform and raw value (username or URL).
 * Returns empty string if value is empty.
 */
export function getSocialProfileUrl(platform: SocialPlatform, value: string | undefined | null): string {
  const v = (value ?? '').trim()
  if (!v) return ''

  const isUrl = IS_URL.test(v)

  switch (platform) {
    case 'instagram': {
      if (isUrl) {
        const match = v.match(/instagram\.com\/([^/?]+)/i)
        const username = match ? trimAndExtractUsername(match[1]) : trimAndExtractUsername(v)
        return username ? `https://www.instagram.com/${username}` : v
      }
      return `https://www.instagram.com/${trimAndExtractUsername(v)}`
    }
    case 'facebook': {
      if (isUrl) {
        const match = v.match(/facebook\.com\/([^/?]+)/i) || v.match(/fb\.com\/([^/?]+)/i) || v.match(/fb\.me\/([^/?]+)/i)
        if (match) {
          const seg = match[1]
          if (seg.startsWith('profile.php') || seg.startsWith('pages')) return v
          return `https://www.facebook.com/${seg}`
        }
        return v
      }
      return `https://www.facebook.com/${trimAndExtractUsername(v)}`
    }
    case 'tiktok': {
      if (isUrl) {
        const match = v.match(/tiktok\.com\/@?([^/?]+)/i)
        const username = match ? trimAndExtractUsername(match[1]) : trimAndExtractUsername(v)
        return username ? `https://www.tiktok.com/@${username}` : v
      }
      const user = trimAndExtractUsername(v)
      return user ? `https://www.tiktok.com/@${user}` : ''
    }
    case 'snapchat': {
      if (isUrl) {
        const match = v.match(/snapchat\.com\/add\/([^/?]+)/i) || v.match(/snapchat\.com\/([^/?]+)/i)
        const username = match ? trimAndExtractUsername(match[1]) : trimAndExtractUsername(v)
        return username ? `https://www.snapchat.com/add/${username}` : v
      }
      const user = trimAndExtractUsername(v)
      return user ? `https://www.snapchat.com/add/${user}` : ''
    }
    case 'website': {
      if (isUrl) return v
      const host = v.replace(/^\/+|\/+$/g, '')
      return host ? `https://${host}` : ''
    }
    default:
      return v
  }
}
