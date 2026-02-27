'use client'

import { motion } from 'framer-motion'
import { MenuData, Product } from '@/app/types/menu'
import { ProductCard } from './ProductCard'
import { ProductListItem } from './ProductListItem'
import { useLanguage } from '@/components/LanguageContext'
import { ViewType } from './ViewSwitcher'
import type { OrderTypeOptions } from '@/components/Cart/CartContext'

interface MenuGridProps {
  menuData: MenuData[]
  onProductClick: (product: Product, prefix: string) => void
  scrollOffset?: number
  viewType?: ViewType
  restaurantLogo?: any
  catalogOnly?: boolean
  tenantContext?: { slug: string; name: string; logoRef?: string }
  orderTypeOptions?: OrderTypeOptions | null
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function MenuGrid({ menuData, onProductClick, scrollOffset = 144, viewType = 'thumbnail', restaurantLogo, catalogOnly = false, tenantContext, orderTypeOptions }: MenuGridProps) {
  const { t } = useLanguage()

  const renderProducts = (products: Product[], prefix: string) => {
    switch (viewType) {
      case 'list':
        return (
          <div className="space-y-3 px-4">
            {products.map((product) => (
              <ProductListItem
                key={product._id}
                product={product}
                onClick={(p) => onProductClick(p, prefix)}
                layoutPrefix={prefix}
                restaurantLogo={restaurantLogo}
                catalogOnly={catalogOnly}
                tenantContext={tenantContext}
                orderTypeOptions={orderTypeOptions}
              />
            ))}
          </div>
        )

      case 'horizontal':
        return (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 snap-x scroll-smooth px-4">
            {products.map((product, index) => (
              <div
                key={product._id}
                className={`w-[196px] md:w-[224px] shrink-0 snap-start h-full ${index === 0 ? 'ms-4' : ''} ${index === products.length - 1 ? 'me-4' : ''}`}
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
                />
              </div>
            ))}
          </div>
        )

      case 'thumbnail-2col':
        return (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-2 gap-3 md:gap-6 px-4 auto-rows-fr"
          >
            {products.map((product) => (
              <motion.div key={product._id} variants={item} className="h-full">
                <ProductCard
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                />
              </motion.div>
            ))}
          </motion.div>
        )

      case 'thumbnail':
      default:
        return (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 auto-rows-fr"
          >
            {products.map((product) => (
              <motion.div key={product._id} variants={item} className="h-full">
                <ProductCard
                  product={product}
                  onClick={(p) => onProductClick(p, prefix)}
                  layoutPrefix={prefix}
                  restaurantLogo={restaurantLogo}
                  catalogOnly={catalogOnly}
                  tenantContext={tenantContext}
                  orderTypeOptions={orderTypeOptions}
                />
              </motion.div>
            ))}
          </motion.div>
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
