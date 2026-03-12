'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Product } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Tag, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { getSaleUnitLabel } from '@/lib/sale-units'
import { cn } from '@/lib/utils'

interface ProductListItemProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  restaurantLogo?: any
  catalogOnly?: boolean
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function ProductListItem({ product, onClick, layoutPrefix = 'list', restaurantLogo, catalogOnly = false, tenantContext, orderTypeOptions, catalogHidePrices = false }: ProductListItemProps) {
  const { lang, t } = useLanguage()
  const { addToCart } = useCart()

  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const priceColor = hasSpecialPrice ? 'text-red-600' : 'text-slate-900'
  const shouldHidePrice = catalogOnly && (catalogHidePrices || product.hidePrice)

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
      layoutId={`${layoutPrefix}-${product._id}`}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(product)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer hover:shadow-lg transition-all duration-300 flex gap-4 p-4"
    >
      {/* Image */}
      <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-50 shrink-0">
        {displayImage ? (
          <Image
            src={urlFor(displayImage).width(200).height(200).url()}
            alt={t(product.title_en, product.title_ar)}
            fill
            sizes="96px"
            placeholder="blur"
            blurDataURL={SHIMMER_PLACEHOLDER}
            className={cn(
              product.image ? "object-cover" : "object-contain p-4"
            )}
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
            {product.isPopular && (
              <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-none flex items-center gap-1 font-black px-2 py-0.5 shadow-lg shadow-amber-500/20 text-[9px] uppercase">
                <Star className="w-2.5 h-2.5 fill-current" />
                {t('Popular', 'أكثر طلباً')}
              </Badge>
            )}
            {hasSpecialPrice && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1 font-black px-2 py-0.5 shadow-lg shadow-red-500/20 text-[9px] uppercase">
                <Tag className="w-2.5 h-2.5 fill-current" />
                {t('Offer', 'عرض')}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-black text-lg leading-tight mb-1 line-clamp-1">
            {t(product.title_en, product.title_ar)}
          </h3>

          {/* Description - Optional */}
          {(product.description_en || product.description_ar) && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-2">
              {t(product.description_en || '', product.description_ar || '')}
            </p>
          )}

          {/* Dietary Tags */}
          {product.dietaryTags && product.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 mt-2">
              {product.dietaryTags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[9px] px-2 py-0.5 bg-slate-100/50 text-slate-500 border-none font-bold uppercase tracking-wider">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Price and Add Button */}
        {!shouldHidePrice && (
          <div className="flex items-center justify-between gap-3 pt-2 mt-auto border-t border-slate-50 min-h-[44px]">
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
                    <span className="text-2xl md:text-3xl font-black tracking-tighter leading-none">
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
            {!catalogOnly && (
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="rounded-full h-9 px-4 bg-black hover:bg-slate-800 shrink-0"
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
