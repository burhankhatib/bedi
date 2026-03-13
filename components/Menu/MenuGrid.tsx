'use client'

import { MenuData, Product } from '@/app/types/menu'
import { ProductCard } from './ProductCard'
import { ProductListItem } from './ProductListItem'
import { useLanguage } from '@/components/LanguageContext'
import { ViewType } from './ViewSwitcher'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'

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
      {menuData.map((category) => (
        <section
          key={category._id}
          id={category._id}
          style={{ scrollMarginTop: `${scrollOffset + 8}px` }}
        >
          <div className="px-4 mb-6">
            <h2 className="text-2xl font-bold mb-1">
              {t(category.title_en, category.title_ar)}
            </h2>
            <div className="h-1 w-12 bg-primary rounded-full" />
          </div>

          {renderProducts(category.products, 'grid')}
        </section>
      ))}
    </div>
  )
}
