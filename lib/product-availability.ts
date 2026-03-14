/**
 * Check if a product is currently unavailable (sold out, etc).
 * Product is unavailable when isAvailable is false AND (no availableAgainAt set OR it's in the future).
 */
export function isProductUnavailable(product: {
  isAvailable?: boolean
  availableAgainAt?: string | null
}): boolean {
  if (product.isAvailable !== false) return false
  const at = product.availableAgainAt
  if (!at || !at.trim()) return true
  const d = new Date(at)
  return isNaN(d.getTime()) || d.getTime() > Date.now()
}
