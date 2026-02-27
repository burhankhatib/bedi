/**
 * SanityLive disabled to save API requests.
 * Live updates for Business Orders, Driver Orders, and Customer order tracking
 * come from custom SSE routes (useSanityLiveStream → /api/.../live) which use client.listen().
 * All pages use client.fetch instead of sanityFetch.
 */
export function SanityLiveGate() {
  return null
}
