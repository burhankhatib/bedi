'use client'

import Image from 'next/image'
import { useState } from 'react'
import { motion } from 'motion/react'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Product } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Tag, Plus, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { getSaleUnitLabel } from '@/lib/sale-units'
import { cn } from '@/lib/utils'
import { isProductUnavailable } from '@/lib/product-availability'

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  priority?: boolean
  restaurantLogo?: any
  catalogOnly?: boolean
  /** When true, show add-to-cart. If undefined, falls back to !catalogOnly. */
  canAddToCart?: boolean
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function ProductCard({ product, onClick, layoutPrefix = 'product', priority = false, restaurantLogo, catalogOnly = false, canAddToCart, tenantContext, orderTypeOptions, catalogHidePrices = false }: ProductCardProps) {
  const { lang, t } = useLanguage()
  const { addToCart } = useCart()
  const [isHovered, setIsHovered] = useState(false)

  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const priceColor = hasSpecialPrice ? 'text-red-600' : 'text-slate-900'
  const shouldHidePrice = catalogOnly && (catalogHidePrices || product.hidePrice)
  const unavailable = isProductUnavailable(product)

  // Get the second image for hover effect (first additional image)
  const hoverImage = product.additionalImages && product.additionalImages.length > 0
    ? product.additionalImages[0]
    : null

  const displayImage = product.image || restaurantLogo

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if ((canAddToCart === false || (canAddToCart === undefined && catalogOnly)) || unavailable) return
    if (product.addOns && product.addOns.length > 0) onClick(product)
    else if (product.variants && product.variants.length > 0) onClick(product)
    else addToCart(product, undefined, undefined, tenantContext, orderTypeOptions ?? undefined)
  }

  return (
    <motion.div
      onClick={() => onClick(product)}
      className={cn(
        'bg-card rounded-[28px] overflow-hidden relative group h-full flex flex-col w-full',
        'transition-[box-shadow,transform] duration-[280ms] ease-[cubic-bezier(0.2,0,0,1)]',
        unavailable ? 'opacity-70 grayscale-[0.3]' : 'cursor-pointer',
        !unavailable && 'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.04)]',
        !unavailable && 'hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)]',
        !unavailable && 'hover:-translate-y-0.5',
        'border border-border/60'
      )}
      style={{ position: 'relative' }}
      whileTap={!unavailable ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Badges Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {unavailable && (
          <Badge className="bg-slate-500/90 hover:bg-slate-600 text-white border-none flex items-center gap-1 font-black px-2.5 py-1 shadow-lg text-[10px] uppercase">
            <XCircle className="w-3 h-3" />
            {t('Unavailable', 'غير متوفر')}
          </Badge>
        )}
        {product.isPopular && !unavailable && (
          <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-none flex items-center gap-1 font-black px-2.5 py-1 shadow-lg shadow-amber-500/20 text-[10px] uppercase">
            <Star className="w-3 h-3 fill-current" />
            {t('Popular', 'أكثر طلباً')}
          </Badge>
        )}
        {hasSpecialPrice && !unavailable && (
          <Badge className="bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1 font-black px-2.5 py-1 shadow-lg shadow-red-500/20 text-[10px] uppercase">
            <Tag className="w-3 h-3 fill-current" />
            {t('Offer', 'عرض')}
          </Badge>
        )}
      </div>

      <div
        className="relative aspect-square w-full overflow-hidden bg-muted/50 rounded-t-[20px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {displayImage ? (
          <>
            {/* Main Image - Always present */}
            <div
              key="main-image"
              style={{ opacity: isHovered && hoverImage ? 0 : 1 }}
              className="absolute inset-0 transition-opacity duration-200"
            >
              <Image
                src={urlFor(displayImage).width(600).height(600).url()}
                alt={t(product.title_en, product.title_ar)}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL={SHIMMER_PLACEHOLDER}
                loading={priority ? "eager" : "lazy"}
                priority={priority}
                fetchPriority={priority ? "high" : "auto"}
                className={cn(
                  "object-center transition-transform duration-700 ease-out",
                  product.image ? "object-cover group-hover:scale-110" : "object-contain p-8"
                )}
              />
            </div>
            {/* Hover Image - Only when hovering and available */}
            {hoverImage && (
              <div
                key="hover-image"
                style={{ opacity: isHovered ? 1 : 0 }}
                className="absolute inset-0 transition-opacity duration-200"
              >
                <Image
                  src={urlFor(hoverImage).width(600).height(600).url()}
                  alt={t(product.title_en, product.title_ar)}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  placeholder="blur"
                  blurDataURL={SHIMMER_PLACEHOLDER}
                  className="object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out"
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
            {t('No Image', 'لا توجد صورة')}
          </div>
        )}
        {/* M3 FAB - Add to Cart */}
        {(canAddToCart ?? !catalogOnly) && !unavailable && (
        <div
          className="absolute bottom-3 right-3 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto transition-opacity duration-200"
        >
          <motion.button
            onClick={handleAddToCart}
            className="relative bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 shadow-[0_2px_6px_rgba(0,0,0,0.15)] rounded-full h-12 w-12 flex items-center justify-center cursor-pointer pointer-events-auto transition-opacity duration-200 min-h-[48px] min-w-[48px]"
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <span className="transition-transform duration-200 group-hover:rotate-90">
              <Plus className="w-6 h-6 shrink-0" />
            </span>
          </motion.button>
        </div>
        )}
      </div>

      <div className="p-5 flex flex-col grow min-h-0">
        <div className="flex flex-col grow">
          {/* M3 Title Large */}
          <h3 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] mb-2 group-hover:text-primary transition-colors duration-200 line-clamp-2 min-h-[2.75rem]">
            {t(product.title_en, product.title_ar)}
          </h3>

          {/* M3 Body Medium - optional description */}
          {(product.description_en || product.description_ar) && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed min-h-[2.5rem]">
              {t(product.description_en || '', product.description_ar || '')}
            </p>
          )}

          {/* Dietary Tags - M3 assistive chips */}
          {product.dietaryTags && product.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 mt-auto">
              {product.dietaryTags?.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted/80 text-muted-foreground border-none font-medium tracking-wide rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {!shouldHidePrice && (
          <div className="flex items-center justify-between gap-3 pt-4 mt-auto border-t border-border/40 min-h-[48px]">
            <div className="flex items-center gap-2 shrink-0 h-[44px]">
              {product.variants && product.variants.length > 0 ? (
                <span className="text-sm font-bold text-slate-600">
                  {t('Choose your choice', 'اختر خيارك')}
                </span>
              ) : (
                <>
                  {hasSpecialPrice && (
                    <span className="text-xs text-slate-400 line-through leading-none">
                      {product.price}
                    </span>
                  )}
                  <div className={`flex flex-wrap items-baseline gap-1 ${priceColor}`}>
                    <span className="text-2xl md:text-[1.75rem] font-semibold tracking-tight leading-none">
                      {hasSpecialPrice ? product.specialPrice : product.price}
                    </span>
                    <span className="text-sm md:text-base font-medium opacity-75 leading-none">
                      {formatCurrency(product.currency)}
                    </span>
                    {product.saleUnit && product.saleUnit !== 'piece' && (
                      <span className="text-xs md:text-sm font-medium opacity-60 leading-none">
                        / {getSaleUnitLabel(product.saleUnit, lang as 'en' | 'ar')}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
