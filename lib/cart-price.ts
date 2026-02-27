/**
 * Effective price modifier for a variant option (regular or special when not expired).
 * Used by ProductModal and cart components so line totals match.
 */
export function getVariantOptionModifier(option: {
  priceModifier?: number
  specialPriceModifier?: number
  specialPriceModifierExpires?: string
}): number {
  const regular = option.priceModifier ?? 0
  const special = option.specialPriceModifier
  const expires = option.specialPriceModifierExpires
  if (typeof special === 'number' && (!expires || new Date(expires) > new Date())) return special
  return regular
}
