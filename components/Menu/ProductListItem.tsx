'use client'

import Image from 'next/image'
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

interface ProductListItemProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  restaurantLogo?: any
  catalogOnly?: boolean
  /** When true, show add-to-cart. If undefined, falls back to !catalogOnly. */
  canAddToCart?: boolean
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function ProductListItem({ product, onClick, layoutPrefix = 'list', restaurantLogo, catalogOnly = false, canAddToCart, tenantContext, orderTypeOptions, catalogHidePrices = false }: ProductListItemProps) {
  const { lang, t } = useLanguage()
  const { addToCart } = useCart()

  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const priceColor = hasSpecialPrice ? 'text-red-600' : 'text-slate-900'
  const shouldHidePrice = catalogOnly && (catalogHidePrices || product.hidePrice)
  const unavailable = isProductUnavailable(product)

  const displayImage = product.image || restaurantLogo

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    // If product has add-ons, open the modal instead of adding directly
    if (product.addOns && product.addOns.length > 0) onClick(product)
    else if (product.variants && product.variants.length > 0) onClick(product)
    else addToCart(product, undefined, undefined, tenantContext, orderTypeOptions ?? undefined)
  }

  return (
    <motion.div
      onClick={() => onClick(product)}
      className="bg-card rounded-2xl overflow-hidden cursor-pointer flex gap-4 p-4 border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-[280ms] ease-[cubic-bezier(0.2,0,0,1)]"
      whileTap={!unavailable ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Image - M3 thumbnail */}
      <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-muted/40 shrink-0">
        {displayImage ? (
          <Image
            src={urlFor(displayImage).width(224).height(224).url()}
            alt={t(product.title_en, product.title_ar)}
            fill
            sizes="112px"
            placeholder="blur"
            blurDataURL={SHIMMER_PLACEHOLDER}
            className="object-contain object-center p-2"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
            {t('No Image', 'لا توجد صورة')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            {unavailable && (
              <Badge className="bg-slate-500/90 hover:bg-slate-600 text-white border-none flex items-center gap-1 font-black px-2 py-0.5 shadow-lg text-[9px] uppercase">
                <XCircle className="w-2.5 h-2.5" />
                {t('Unavailable', 'غير متوفر')}
              </Badge>
            )}
            {product.isPopular && !unavailable && (
              <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-none flex items-center gap-1 font-black px-2 py-0.5 shadow-lg shadow-amber-500/20 text-[9px] uppercase">
                <Star className="w-2.5 h-2.5 fill-current" />
                {t('Popular', 'أكثر طلباً')}
              </Badge>
            )}
            {hasSpecialPrice && !unavailable && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1 font-black px-2 py-0.5 shadow-lg shadow-red-500/20 text-[9px] uppercase">
                <Tag className="w-2.5 h-2.5 fill-current" />
                {t('Offer', 'عرض')}
              </Badge>
            )}
          </div>

          {/* M3 Title Medium */}
          <h3 className="text-base font-semibold leading-tight mb-1 line-clamp-1 tracking-tight">
            {t(product.title_en, product.title_ar)}
          </h3>

          {/* M3 Body Small */}
          {(product.description_en || product.description_ar) && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {t(product.description_en || '', product.description_ar || '')}
            </p>
          )}

          {/* Dietary Tags */}
          {product.dietaryTags && product.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 mt-2">
              {product.dietaryTags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted/80 text-muted-foreground border-none font-medium tracking-wide rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Price and Add Button - M3 48dp touch target */}
        {!shouldHidePrice && (
          <div className="flex items-center justify-between gap-3 pt-3 mt-auto border-t border-border/40 min-h-[48px]">
            <div className="flex items-center gap-2 h-[36px]">
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
                    <span className="text-xl md:text-2xl font-semibold tracking-tight leading-none">
                      {hasSpecialPrice ? product.specialPrice : product.price}
                    </span>
                    <span className="text-base md:text-lg font-bold opacity-70 leading-none">
                      {formatCurrency(product.currency)}
                    </span>
                    {product.saleUnit && product.saleUnit !== 'piece' && (
                      <span className="text-xs font-medium opacity-60 leading-none">
                        / {getSaleUnitLabel(product.saleUnit, lang as 'en' | 'ar')}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            {(canAddToCart ?? !catalogOnly) && !unavailable && (
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="rounded-full h-10 px-5 bg-primary text-primary-foreground hover:opacity-90 shrink-0 min-h-[40px] font-medium transition-opacity duration-200"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t('Add', 'إضافة')}
            </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
