'use client'

import { useMemo } from 'react'
import { MenuData, Product } from '@/app/types/menu'
import { ProductCard } from './ProductCard'
import { ProductListItem } from './ProductListItem'
import { useLanguage } from '@/components/LanguageContext'
import { ViewType } from './ViewSwitcher'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'

type CategoryGroup = { root: MenuData; subs: MenuData[] }

function groupCategoriesByRoot(menuData: MenuData[]): CategoryGroup[] {
  const groups: CategoryGroup[] = []
  for (const cat of menuData) {
    if (!cat.parentCategoryRef) {
      groups.push({ root: cat, subs: [] })
    } else {
      const last = groups[groups.length - 1]
      if (last && last.root._id === cat.parentCategoryRef) {
        last.subs.push(cat)
      } else {
        const parent = groups.find((g) => g.root._id === cat.parentCategoryRef)
        if (parent) parent.subs.push(cat)
      }
    }
  }
  return groups
}

interface MenuGridProps {
  menuData: MenuData[]
  onProductClick: (product: Product, prefix: string) => void
  scrollOffset?: number
  viewType?: ViewType
  restaurantLogo?: any
  catalogOnly?: boolean
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function MenuGrid({ menuData, onProductClick, scrollOffset = 144, viewType = 'thumbnail', restaurantLogo, catalogOnly = false, tenantContext, orderTypeOptions, catalogHidePrices = false }: MenuGridProps) {
  const { t } = useLanguage()
  const groups = useMemo(() => groupCategoriesByRoot(menuData), [menuData])

  const renderProducts = (products: Product[], prefix: string) => {
    switch (viewType) {
      case 'list':
        return (
          <div className="space-y-3 px-4">
            {products.map((product) => (
              <div key={product._id} id={`product-${product._id}`}>
                <ProductListItem
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                  catalogHidePrices={catalogHidePrices}
                />
              </div>
            ))}
          </div>
        )

      case 'horizontal':
        return (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 snap-x scroll-smooth px-4 items-stretch">
            {products.map((product, index) => (
              <div
                key={product._id}
                id={`product-${product._id}`}
                className={`w-[196px] md:w-[224px] shrink-0 snap-start flex flex-col h-auto ${index === 0 ? 'ms-4' : ''} ${index === products.length - 1 ? 'me-4' : ''}`}
              >
                <ProductCard
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  priority={index === 0 || index === 1}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                  catalogHidePrices={catalogHidePrices}
                />
              </div>
            ))}
          </div>
        )

      case 'thumbnail-2col':
        return (
          <div className="grid grid-cols-2 gap-3 md:gap-6 px-4 auto-rows-fr">
            {products.map((product) => (
              <div key={product._id} id={`product-${product._id}`} className="h-full">
                <ProductCard
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                  catalogHidePrices={catalogHidePrices}
                />
              </div>
            ))}
          </div>
        )

      case 'thumbnail':
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 auto-rows-fr">
            {products.map((product) => (
              <div key={product._id} id={`product-${product._id}`} className="h-full">
                <ProductCard
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                  catalogHidePrices={catalogHidePrices}
                />
              </div>
            ))}
          </div>
        )
    }
  }

  return (
    <div className="space-y-12 pb-20">
      {groups.map(({ root, subs }) => (
        <section
          key={root._id}
          id={root._id}
          style={{ scrollMarginTop: `${scrollOffset + 8}px` }}
        >
          <div className="px-4 mb-6">
            <h2 className="text-2xl font-bold mb-1">
              {t(root.title_en, root.title_ar)}
            </h2>
            <div className="h-1 w-12 bg-primary rounded-full" />
          </div>

          {root.products && root.products.length > 0 && (
            <div className="mb-8">
              {renderProducts(root.products, 'grid')}
            </div>
          )}

          {subs.map((sub) => (
            <div key={sub._id} className="mb-10 last:mb-0">
              <h3 className="text-base font-semibold text-slate-600 px-4 mb-4 border-s-2 border-slate-300 ps-4">
                {t(sub.title_en, sub.title_ar)}
              </h3>
              {sub.products && sub.products.length > 0 ? (
                renderProducts(sub.products, 'grid')
              ) : (
                <p className="text-sm text-slate-500 px-4 italic">
                  {t('No products in this category yet.', 'لا توجد منتجات في هذه الفئة بعد.')}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
