/**
 * Sale units for products (piece, kg, gram, etc.).
 * Used when creating products and in catalog defaults.
 */

export type SaleUnit = string

export const SALE_UNITS: Array<{ value: SaleUnit; label_en: string; label_ar: string }> = [
  { value: 'piece', label_en: 'Piece / Each', label_ar: 'قطعة' },
  { value: 'kg', label_en: 'Per kg', label_ar: 'لكل كيلو' },
  { value: 'g', label_en: 'Per 100g', label_ar: 'لكل 100 جرام' },
  { value: 'liter', label_en: 'Per liter', label_ar: 'لكل لتر' },
  { value: 'ml', label_en: 'Per bottle/can', label_ar: 'لكل زجاجة/علبة' },
  { value: 'pack', label_en: 'Per pack', label_ar: 'لكل حزمة' },
  { value: 'box', label_en: 'Per box', label_ar: 'لكل صندوق' },
  { value: 'bottle', label_en: 'Per bottle', label_ar: 'لكل زجاجة' },
  { value: 'can', label_en: 'Per can', label_ar: 'لكل علبة' },
  { value: 'bag', label_en: 'Per bag', label_ar: 'لكل كيس' },
  { value: 'dozen', label_en: 'Per dozen', label_ar: 'لكل درزن' },
  { value: 'jar', label_en: 'Per jar', label_ar: 'لكل برطمان' },
]

export function getSaleUnitLabel(value: SaleUnit | null | undefined, lang: 'en' | 'ar'): string {
  if (!value) return ''
  const u = SALE_UNITS.find((x) => x.value === value)
  return u ? (lang === 'ar' ? u.label_ar : u.label_en) : value
}

export function getSaleUnitByValue(value: SaleUnit | null | undefined) {
  return SALE_UNITS.find((x) => x.value === value) ?? null
}

/** Whether this unit uses weight (kg) or fractional weight (g = per 100g). Quantity = weight. */
export function isWeightBasedUnit(unit: SaleUnit | null | undefined): boolean {
  return unit === 'kg' || unit === 'g'
}

/** Whether this unit uses volume (liter). Quantity = liters. */
export function isVolumeBasedUnit(unit: SaleUnit | null | undefined): boolean {
  return unit === 'liter'
}

/** Preset weight options for quick selection (kg). Steps in kg. */
export const WEIGHT_PRESETS_KG: number[] = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]

/** Preset options for per-100g unit. Quantity = number of 100g (0.5 = 50g, 2 = 200g). */
export const WEIGHT_PRESETS_100G: number[] = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]

/** Minimum quantity for weight/volume items. */
export const WEIGHT_MIN = 0.05

/** Step size when incrementing/decrementing weight (kg or 100g units). */
export const WEIGHT_STEP = 0.25

/** Format quantity for display: "1.5 kg" or "2×" for pieces. */
export function formatQuantityWithUnit(
  quantity: number,
  unit: SaleUnit | null | undefined,
  lang: 'en' | 'ar'
): string {
  if (!unit || unit === 'piece') {
    const q = Math.round(quantity)
    return lang === 'ar' ? `${q}×` : `×${q}`
  }
  if (unit === 'kg') {
    const q = quantity % 1 === 0 ? quantity : quantity.toFixed(2).replace(/\.?0+$/, '')
    return `${q} ${lang === 'ar' ? 'كغ' : 'kg'}`
  }
  if (unit === 'g') {
    const grams = Math.round(quantity * 100)
    return `${grams} ${lang === 'ar' ? 'غ' : 'g'}`
  }
  if (unit === 'liter') {
    const q = quantity % 1 === 0 ? quantity : quantity.toFixed(2).replace(/\.?0+$/, '')
    return `${q} ${lang === 'ar' ? 'لتر' : 'L'}`
  }
  const q = Math.round(quantity)
  return lang === 'ar' ? `${q}×` : `×${q}`
}
