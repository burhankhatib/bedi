'use client'

import Image from 'next/image'
import { useState } from 'react'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Product } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'
import { Badge } from '@/components/ui/badge'
import { Star, Tag, Plus, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { isProductUnavailable } from '@/lib/product-availability'

interface PopularProductCardProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  priority?: boolean
  restaurantLogo?: any
  catalogOnly?: boolean
  /** When true, show add-to-cart button. When false, hide. If undefined, falls back to !catalogOnly. */
  canAddToCart?: boolean
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
  canAddToCart,
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
  const unavailable = isProductUnavailable(product)
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
    <div
      onClick={() => onClick(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative w-[320px] md:w-[450px] h-[220px] md:h-[280px] rounded-[32px] overflow-hidden group shrink-0 shadow-xl shadow-black/5',
        unavailable ? 'opacity-70 grayscale-[0.2]' : 'cursor-pointer'
      )}
    >
      {/* Background Image Layer */}
      <div className="absolute inset-0 bg-slate-900">
        {displayImage && (
          <>
            <div style={{ opacity: isHovered && hoverImage ? 0 : 1 }} className="absolute inset-0 transition-opacity duration-300">
              <Image
                src={urlFor(displayImage).width(900).height(560).url()}
                alt={t(product.title_en, product.title_ar)}
                fill
                sizes="(max-width: 768px) 320px, 450px"
                placeholder="blur"
                blurDataURL={SHIMMER_PLACEHOLDER}
                priority={priority}
                className="object-contain object-center p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            
            {hoverImage && (
              <div style={{ opacity: isHovered ? 1 : 0 }} className="absolute inset-0 transition-opacity duration-300">
                <Image
                  src={urlFor(hoverImage).width(900).height(560).url()}
                  alt={t(product.title_en, product.title_ar)}
                  fill
                  sizes="(max-width: 768px) 320px, 450px"
                  placeholder="blur"
                  blurDataURL={SHIMMER_PLACEHOLDER}
                  className="object-contain object-center p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Dark Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {unavailable && (
          <Badge className="bg-slate-500/90 text-white border-none font-black px-3 py-1 shadow-lg text-[10px] uppercase tracking-wider rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {t('Unavailable', 'غير متوفر')}
          </Badge>
        )}
        <Badge className="bg-amber-400 text-amber-950 border-none font-black px-3 py-1 shadow-lg text-[10px] uppercase tracking-wider rounded-full">
          <Star className="w-3 h-3 fill-current mr-1" />
          {t('Popular', 'الأكثر طلباً')}
        </Badge>
        {hasSpecialPrice && !unavailable && (
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

          {/* Floating Add to Cart Button - hidden when closed or unavailable */}
          {(canAddToCart ?? !catalogOnly) && !unavailable && (
          <button
            onClick={handleAddToCart}
            className="relative bg-black hover:bg-slate-800 active:bg-slate-700 shadow-2xl rounded-2xl h-12 w-12 flex items-center justify-center cursor-pointer pointer-events-auto shrink-0 transition-colors"
          >
            <span className="transition-transform duration-300 group-hover:rotate-180">
              <Plus className="w-6 h-6 text-white shrink-0" />
            </span>
          </button>
          )}
        </div>
      </div>
    </div>
  )
}
