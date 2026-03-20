/**
 * Default Lucide icon (kebab-case key for `lucide-react/dynamicIconImports`) per seeded
 * sub-category. All keys in the seed set get a unique icon; semantic hints override when free.
 */

import { BY_BUSINESS_TYPE } from '@/lib/business-subcategories-seed'
import { LUCIDE_ALL_KEYS_SORTED } from '@/lib/lucide-all-keys-sorted'

/** High-signal slugs → icon; only applied if that icon is still unused. */
const SEMANTIC: Record<string, string> = {
  'restaurant::pizza': 'pizza',
  'restaurant::burgers': 'hamburger',
  'restaurant::sandwiches': 'sandwich',
  'restaurant::sushi': 'fish',
  'restaurant::seafood': 'fish',
  'restaurant::drinks': 'cup-soda',
  'restaurant::juices': 'glass-water',
  'restaurant::coffee': 'coffee',
  'restaurant::tea': 'cup-soda',
  'restaurant::wine': 'wine',
  'restaurant::beer': 'beer',
  'restaurant::ice-cream': 'ice-cream-bowl',
  'restaurant::donuts': 'donut',
  'restaurant::desserts': 'cake',
  'restaurant::cake': 'cake-slice',
  'restaurant::cookies': 'cookie',
  'restaurant::pastries': 'croissant',
  'restaurant::salads': 'salad',
  'restaurant::soups': 'soup',
  'restaurant::noodles': 'soup',
  'restaurant::ramen': 'soup',
  'restaurant::wings': 'drumstick',
  'restaurant::fried-chicken': 'drumstick',
  'restaurant::broasted': 'drumstick',
  'restaurant::grills': 'flame',
  'restaurant::barbecue': 'flame',
  'restaurant::steakhouse': 'beef',
  'restaurant::healthy': 'salad',
  'restaurant::vegan': 'leaf',
  'restaurant::vegetarian': 'leaf',
  'restaurant::mandi': 'cooking-pot',
  'restaurant::kabsa': 'cooking-pot',
  'restaurant::rice-dishes': 'cooking-pot',
  'restaurant::falafel': 'cookie',
  'restaurant::hummus': 'bean',
  'restaurant::mezze': 'utensils-crossed',
  'cafe::coffee': 'coffee',
  'cafe::tea': 'cup-soda',
  'cafe::smoothies': 'glass-water',
  'cafe::juices': 'glass-water',
  'cafe::desserts': 'cake',
  'cafe::ice-cream': 'ice-cream-bowl',
  'cafe::sandwiches': 'sandwich',
  'cafe::salads': 'salad',
  'cafe::pastries': 'croissant',
  'cafe::breakfast': 'egg-fried',
  'bakery::bread': 'sandwich',
  'bakery::pastries': 'croissant',
  'bakery::cakes': 'cake',
  'bakery::cookies': 'cookie',
  'bakery::oriental-sweets': 'candy',
  'bakery::manakeesh': 'pizza',
  'grocery::dairy': 'milk',
  'grocery::fruits-vegetables': 'carrot',
  'grocery::organic': 'leaf',
  'pharmacy::full': 'pill',
  'pharmacy::mini': 'pill',
  'butcher::meat': 'beef',
  'butcher::chicken': 'drumstick',
  'butcher::frozen': 'snowflake',
  'gas::gas-cylinders': 'flame',
  'gas::camping-gas': 'flame',
  'water::water-bottles': 'glass-water',
  'water::water-gallons': 'glass-water',
  'retail::clothing': 'shirt',
  'retail::electronics': 'smartphone',
  'retail::gifts': 'gift',
}

function buildMap(): Record<string, string> {
  const used = new Set<string>()
  const out: Record<string, string> = {}
  const pairs: string[] = []
  for (const [bt, rows] of Object.entries(BY_BUSINESS_TYPE)) {
    for (const row of rows) {
      pairs.push(`${bt}::${row.slug}`)
    }
  }
  pairs.sort((a, b) => a.localeCompare(b))
  let poolI = 0
  for (const key of pairs) {
    let icon: string | undefined = SEMANTIC[key]
    if (icon && used.has(icon)) icon = undefined
    if (!icon) {
      while (poolI < LUCIDE_ALL_KEYS_SORTED.length && used.has(LUCIDE_ALL_KEYS_SORTED[poolI]!)) {
        poolI++
      }
      icon = LUCIDE_ALL_KEYS_SORTED[poolI++] ?? 'circle'
    }
    used.add(icon)
    out[key] = icon
  }
  return out
}

export const SUBCATEGORY_DEFAULT_LUCIDE_MAP: Record<string, string> = buildMap()

export function defaultLucideKeyForSubcategory(businessType: string, slug: string): string {
  const k = `${businessType}::${slug}`
  const mapped = SUBCATEGORY_DEFAULT_LUCIDE_MAP[k]
  if (mapped) return mapped
  let h = 0
  for (let i = 0; i < k.length; i++) h = Math.imul(31, h) + k.charCodeAt(i)
  const idx = Math.abs(h) % LUCIDE_ALL_KEYS_SORTED.length
  return LUCIDE_ALL_KEYS_SORTED[idx] ?? 'circle'
}
