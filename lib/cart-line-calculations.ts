import type { Product, ProductAddOn } from '@/app/types/menu'
import { getVariantOptionModifier } from '@/lib/cart-price'

/** Minimal shape for pricing a cart line (avoids circular imports with CartContext). */
export type CartLinePricingInput = Pick<
  Product,
  'price' | 'specialPrice' | 'specialPriceExpires' | 'addOns' | 'variants' | 'currency'
> & {
  quantity: number
  selectedAddOns?: string[]
  selectedVariants?: (number | undefined)[]
}

export function hasActiveSpecialPrice(
  item: Pick<Product, 'specialPrice' | 'specialPriceExpires'>
): boolean {
  return !!(
    item.specialPrice &&
    (!item.specialPriceExpires || new Date(item.specialPriceExpires) > new Date())
  )
}

/** Group selectedAddOns (with duplicates) into display rows. */
export function groupAddOnsByKey(
  selectedAddOns: string[] | undefined,
  addOns: ProductAddOn[] | undefined
): Array<{ addOnKey: string; addOn: ProductAddOn; count: number }> {
  if (!selectedAddOns?.length) return []
  const countByKey: Record<string, number> = {}
  for (const key of selectedAddOns) {
    countByKey[key] = (countByKey[key] || 0) + 1
  }
  return Object.entries(countByKey)
    .map(([addOnKey, count]) => {
      const addOn = addOns?.find(
        (a) => a._key === addOnKey || `${a.name_en}-${a.price}` === addOnKey
      )
      return addOn ? { addOnKey, addOn, count } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
}

function sumAddOnPrices(
  selectedAddOns: string[] | undefined,
  addOns: ProductAddOn[] | undefined
): number {
  if (!selectedAddOns?.length) return 0
  return selectedAddOns.reduce((sum, addOnKey) => {
    const addOn = addOns?.find(
      (a) => a._key === addOnKey || `${a.name_en}-${a.price}` === addOnKey
    )
    return sum + (addOn?.price || 0)
  }, 0)
}

function sumVariantModifier(
  variants: Product['variants'],
  selectedVariants: (number | undefined)[] | undefined
): number {
  if (!variants?.length || !selectedVariants?.length) return 0
  let variantPrice = 0
  variants.forEach((group, gi) => {
    const optionIndex = selectedVariants[gi]
    if (optionIndex === undefined) return
    const option = group.options?.[optionIndex]
    if (option) variantPrice += getVariantOptionModifier(option)
  })
  return variantPrice
}

/** Unit price for one cart line (before quantity). */
export function getCartLineUnitPrice(item: CartLinePricingInput): number {
  const basePrice = hasActiveSpecialPrice(item) ? item.specialPrice! : item.price
  const addOnPrice = sumAddOnPrices(item.selectedAddOns, item.addOns)
  const variantPrice = sumVariantModifier(item.variants, item.selectedVariants)
  return basePrice + addOnPrice + variantPrice
}

export function getCartLineTotal(item: CartLinePricingInput): number {
  return getCartLineUnitPrice(item) * item.quantity
}

/** Variant labels + price slice for order payload / summaries. */
export function getVariantBreakdownForLang(
  item: Pick<Product, 'variants'> & { selectedVariants?: (number | undefined)[] },
  lang: 'en' | 'ar'
): { variantPrice: number; variantParts: string[] } {
  let variantPrice = 0
  const variantParts: string[] = []
  if (!item.variants?.length || !item.selectedVariants?.length) {
    return { variantPrice, variantParts }
  }
  item.variants.forEach((group, gi) => {
    const optionIndex = item.selectedVariants![gi]
    if (optionIndex === undefined) return
    const option = group.options?.[optionIndex]
    if (option) {
      variantPrice += getVariantOptionModifier(option)
      const groupName = lang === 'ar' ? group.name_ar : group.name_en
      const optionLabel = lang === 'ar' ? option.label_ar : option.label_en
      variantParts.push(`${groupName}: ${optionLabel}`)
    }
  })
  return { variantPrice, variantParts }
}

/** Arabic-only variant lines for WhatsApp. */
export function getVariantBreakdownAr(
  item: Pick<Product, 'variants'> & { selectedVariants?: (number | undefined)[] }
): { variantPrice: number; variantPartsAr: string[] } {
  let variantPrice = 0
  const variantPartsAr: string[] = []
  if (!item.variants?.length || !item.selectedVariants?.length) {
    return { variantPrice, variantPartsAr }
  }
  item.variants.forEach((group, gi) => {
    const optionIndex = item.selectedVariants![gi]
    if (optionIndex === undefined) return
    const option = group.options?.[optionIndex]
    if (option) {
      variantPrice += getVariantOptionModifier(option)
      variantPartsAr.push(`${group.name_ar}: ${option.label_ar}`)
    }
  })
  return { variantPrice, variantPartsAr }
}

export function formatAddOnsListForLang(
  item: Pick<Product, 'addOns'> & { selectedAddOns?: string[] },
  lang: 'en' | 'ar'
): string {
  return groupAddOnsByKey(item.selectedAddOns, item.addOns)
    .map(({ addOn, count }) => {
      const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
      if (count === 1) return addOn.price > 0 ? `${addOnName} (+${addOn.price})` : addOnName
      const total = addOn.price * count
      return addOn.price > 0 ? `${addOnName} x${count} (+${total})` : `${addOnName} x${count}`
    })
    .join(', ')
}

export function formatAddOnsListAr(
  item: Pick<Product, 'addOns'> & { selectedAddOns?: string[] }
): string {
  return groupAddOnsByKey(item.selectedAddOns, item.addOns)
    .map(({ addOn, count }) => {
      if (count === 1) return addOn.price > 0 ? `${addOn.name_ar} (+${addOn.price})` : addOn.name_ar
      const total = addOn.price * count
      return addOn.price > 0 ? `${addOn.name_ar} x${count} (+${total})` : `${addOn.name_ar} x${count}`
    })
    .join('، ')
}
