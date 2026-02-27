/**
 * Formats currency for display
 * Replaces "ILS" with the actual ILS symbol (₪)
 */
export function formatCurrency(currency: string | undefined | null): string {
  if (!currency) return '₪'
  return currency === 'ILS' || currency.toUpperCase() === 'ILS' ? '₪' : currency
}
