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
