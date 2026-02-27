/**
 * Parse latitude and longitude from a Google Maps URL (place link, share link, etc.).
 * Used to build "start navigation" URLs for Google Maps and Waze.
 */
export function parseCoordsFromGoogleMapsUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null
  const s = url.trim()
  // /@31.768319,35.213710 or /@31.768319,35.213710,17z
  const atMatch = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|$|\/)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }
  // ?q=31.768319,35.213710
  const qMatch = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }
  // !3d31.768319!4d35.213710 (3d=lat, 4d=lng)
  const d3Match = s.match(/!3d(-?\d+\.?\d*)/)
  const d4Match = s.match(/!4d(-?\d+\.?\d*)/)
  if (d3Match && d4Match) {
    const lat = parseFloat(d3Match[1])
    const lng = parseFloat(d4Match[1])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }
  return null
}

/** Google Maps URL that starts directions/navigation to destination. Use coords when available for reliability. */
export function googleMapsNavigationUrl(destination: { lat: number; lng: number } | string): string {
  if (typeof destination === 'string') {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
}

/** Waze URL that starts navigation. Use coords when available (more reliable on iOS). */
export function wazeNavigationUrl(destination: { lat: number; lng: number } | string): string {
  if (typeof destination === 'string') {
    return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`
  }
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`
}

/** Haversine distance in km between two coordinates. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}
