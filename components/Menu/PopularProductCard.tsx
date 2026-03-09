'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { urlFor } from '@/sanity/lib/image'
import { Product } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'
import { Badge } from '@/components/ui/badge'
import { Star, Tag, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface PopularProductCardProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  priority?: boolean
  restaurantLogo?: any
  catalogOnly?: boolean
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function PopularProductCard({
  product,
  onClick,
  layoutPrefix = 'popular',
  priority = false,
  restaurantLogo,
  catalogOnly = false,
  tenantContext,
  orderTypeOptions,
  catalogHidePrices = false,
}: PopularProductCardProps) {
  const { lang, t } = useLanguage()
  const { addToCart } = useCart()
  const [isHovered, setIsHovered] = useState(false)

  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const shouldHidePrice = catalogOnly && (catalogHidePrices || product.hidePrice)
  const displayImage = product.image || restaurantLogo

  // Get the second image for hover effect
  const hoverImage = product.additionalImages && product.additionalImages.length > 0
    ? product.additionalImages[0]
    : null

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    // If product has add-ons, open the modal instead of adding directly
    if (product.addOns && product.addOns.length > 0) onClick(product)
    else if (product.variants && product.variants.length > 0) onClick(product)
    else addToCart(product, undefined, undefined, tenantContext, orderTypeOptions ?? undefined)
  }

  return (
    <motion.div
      layoutId={`${layoutPrefix}-${product._id}`}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-[320px] md:w-[450px] h-[220px] md:h-[280px] rounded-[32px] overflow-hidden cursor-pointer group shrink-0 shadow-xl shadow-black/5"
    >
      {/* Background Image Layer */}
      <div className="absolute inset-0 bg-slate-100">
        {displayImage && (
          <>
            <motion.div
              animate={{ opacity: isHovered && hoverImage ? 0 : 1 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src={urlFor(displayImage).width(800).height(500).url()}
                alt={t(product.title_en, product.title_ar)}
                fill
                priority={priority}
                className={cn(
                  "transition-transform duration-700 ease-out group-hover:scale-110",
                  product.image ? "object-cover" : "object-contain p-12"
                )}
              />
            </motion.div>
            
            {hoverImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <Image
                  src={urlFor(hoverImage).width(800).height(500).url()}
                  alt={t(product.title_en, product.title_ar)}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Dark Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Badge className="bg-amber-400 text-amber-950 border-none font-black px-3 py-1 shadow-lg text-[10px] uppercase tracking-wider rounded-full">
          <Star className="w-3 h-3 fill-current mr-1" />
          {t('Popular', 'الأكثر طلباً')}
        </Badge>
        {hasSpecialPrice && (
          <Badge className="bg-red-500 text-white border-none font-black px-3 py-1 shadow-lg text-[10px] uppercase tracking-wider rounded-full">
            <Tag className="w-3 h-3 fill-current mr-1" />
            {t('Offer', 'عرض')}
          </Badge>
        )}
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end gap-2">
        <h3 className="text-white font-black text-xl md:text-2xl leading-tight drop-shadow-sm truncate">
          {t(product.title_en, product.title_ar)}
        </h3>
        
        <div className="flex items-center justify-between gap-4 mt-1 min-h-[48px]">
          <div className="flex-1 min-w-0">
            {!shouldHidePrice && (
              <div className="flex items-center gap-2">
                {product.variants && product.variants.length > 0 ? (
                  <span className="text-white/90 text-sm font-bold">
                    {t('Choose your choice', 'اختر خيارك')}
                  </span>
                ) : (
                  <>
                    {hasSpecialPrice && (
                      <span className="text-white/50 text-sm line-through font-bold">
                        {product.price}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        "text-2xl md:text-3xl font-black tracking-tighter drop-shadow-md",
                        hasSpecialPrice ? "text-red-400" : "text-white"
                      )}>
                        {hasSpecialPrice ? product.specialPrice : product.price}
                      </span>
                      <span className="text-sm md:text-base font-bold text-white/70">
                        {formatCurrency(product.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Floating Add to Cart Button - hidden when closed */}
          {!catalogOnly && (
          <motion.button
            onClick={handleAddToCart}
            className="relative bg-black shadow-2xl rounded-2xl h-12 w-12 flex items-center justify-center cursor-pointer pointer-events-auto shrink-0"
            whileHover={{
              backgroundColor: '#1e293b'
            }}
            whileTap={{
              scale: 0.95,
              backgroundColor: '#334155'
            }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <Plus className="w-6 h-6 text-white shrink-0" />
            </motion.div>
          </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
