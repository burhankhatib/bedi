/**
 * Sorts products within each category based on productSortMode.
 * Used for the customer-facing menu so Name/Price sort preferences are reflected.
 */

import type { Product } from '@/app/types/menu'

export type ProductSortMode = 'manual' | 'name' | 'price'

interface CategoryWithProducts {
  _id: string
  products: Product[]
  productSortMode?: string | null
}

function sortProducts(products: Product[], mode: string | null | undefined): Product[] {
  if (!mode || mode === 'manual') return products
  const list = [...products]
  if (mode === 'name') {
    return list.sort((a, b) => {
      const cmp = (a.title_en || '').toLowerCase().localeCompare((b.title_en || '').toLowerCase())
      return cmp !== 0 ? cmp : (a._id || '').localeCompare(b._id || '')
    })
  }
  if (mode === 'price') {
    return list.sort((a, b) => {
      const pa = a.price
      const pb = b.price
      if (pa !== pb) return pa - pb
      return (a._id || '').localeCompare(b._id || '')
    })
  }
  return products
}

/**
 * Sorts products in each category based on productSortMode.
 * Modifies the categories in place.
 */
export function applyProductSortToMenuData<T extends CategoryWithProducts>(categories: T[]): T[] {
  for (const cat of categories) {
    if (cat.products && Array.isArray(cat.products)) {
      cat.products = sortProducts(cat.products, cat.productSortMode)
    }
  }
  return categories
}
