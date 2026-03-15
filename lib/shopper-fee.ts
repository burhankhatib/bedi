export type ShopperFeeTier = {
  minItems: number
  maxItems: number | null
  fee: number
  labelEn: string
  labelAr: string
}

export const SHOPPER_FEE_TIERS: ShopperFeeTier[] = [
  { minItems: 0, maxItems: 3, fee: 0, labelEn: 'Up to 3 items', labelAr: 'حتى 3 أصناف' },
  { minItems: 4, maxItems: 10, fee: 5, labelEn: '4-10 items', labelAr: '4-10 أصناف' },
  { minItems: 11, maxItems: 20, fee: 10, labelEn: '11-20 items', labelAr: '11-20 صنف' },
  { minItems: 21, maxItems: 30, fee: 15, labelEn: '21-30 items', labelAr: '21-30 صنف' },
  { minItems: 31, maxItems: null, fee: 20, labelEn: '31+ items', labelAr: '31+ صنف' },
]

export function getShopperFeeByItemCount(itemCount: number): number {
  const safeCount = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0
  const tier = SHOPPER_FEE_TIERS.find((entry) => {
    if (entry.maxItems == null) return safeCount >= entry.minItems
    return safeCount >= entry.minItems && safeCount <= entry.maxItems
  })
  return tier?.fee ?? 0
}

/** Friendly explanation for the Save Time fee (driver picks items at store). */
export function getShopperFeeExplanation(
  itemCount: number,
  lang: 'en' | 'ar',
  currencySymbol: string
): { title: string; body: string; freeLabel?: string } {
  const fee = getShopperFeeByItemCount(itemCount)
  const safeCount = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0

  if (fee === 0) {
    return {
      title: lang === 'ar' ? 'رسوم توفير الوقت' : 'Save Time fee',
      body:
        lang === 'ar'
          ? 'سائقنا يجمع طلبك من المتجر لتوفير وقتك. مجاناً للطلبات الصغيرة (حتى 3 أصناف).'
          : 'Our driver picks your order at the store to save you time. Free for small orders (up to 3 items).',
      freeLabel: lang === 'ar' ? 'مجاناً' : 'FREE',
    }
  }

  return {
    title: lang === 'ar' ? 'رسوم توفير الوقت' : 'Save Time fee',
    body:
      lang === 'ar'
        ? `سائقنا يجمع ${safeCount} صنفاً من المتجر نيابة عنك لتوفير وقتك.`
        : `Our driver picks your ${safeCount} items at the store for you to save your time.`,
  }
}
