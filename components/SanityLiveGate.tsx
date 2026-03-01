/**
 * SanityLive disabled to save API requests.
 * Live updates for Business Orders, Driver Orders, and Customer order tracking
 * come from custom SSE routes (which were replaced by Pusher) and which used client.listen().
 * All pages use client.fetch instead of sanityFetch.
 */
export function SanityLiveGate() {
  return null
}
