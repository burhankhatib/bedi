'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { urlFor } from '@/sanity/lib/image'
import { Product } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions } from '@/components/Cart/CartContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Tag, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
  layoutPrefix?: string
  priority?: boolean
  restaurantLogo?: any
  catalogOnly?: boolean
  tenantContext?: { slug: string; name: string; logoRef?: string }
  orderTypeOptions?: OrderTypeOptions | null
}

export function ProductCard({ product, onClick, layoutPrefix = 'product', priority = false, restaurantLogo, catalogOnly = false, tenantContext, orderTypeOptions }: ProductCardProps) {
  const { lang, t } = useLanguage()
  const { addToCart } = useCart()
  const [isHovered, setIsHovered] = useState(false)

  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const priceColor = hasSpecialPrice ? 'text-red-600' : 'text-slate-900'

  // Get the second image for hover effect (first additional image)
  const hoverImage = product.additionalImages && product.additionalImages.length > 0
    ? product.additionalImages[0]
    : null

  const displayImage = product.image || restaurantLogo

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (catalogOnly) return
    if (product.addOns && product.addOns.length > 0) onClick(product)
    else if (product.variants && product.variants.length > 0) onClick(product)
    else addToCart(product, undefined, undefined, tenantContext, orderTypeOptions ?? undefined)
  }

  return (
    <motion.div
      layoutId={`${layoutPrefix}-${product._id}`}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(product)}
      className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl transition-all duration-500 relative group h-full flex flex-col"
      style={{ position: 'relative' }}
    >
      {/* Badges Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {product.isPopular && (
          <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-none flex items-center gap-1 font-black px-2.5 py-1 shadow-lg shadow-amber-500/20 text-[10px] uppercase">
            <Star className="w-3 h-3 fill-current" />
            {t('Popular', 'أكثر طلباً')}
          </Badge>
        )}
        {hasSpecialPrice && (
          <Badge className="bg-red-500 hover:bg-red-600 text-white border-none flex items-center gap-1 font-black px-2.5 py-1 shadow-lg shadow-red-500/20 text-[10px] uppercase">
            <Tag className="w-3 h-3 fill-current" />
            {t('Offer', 'عرض')}
          </Badge>
        )}
      </div>

      <div
        className="relative aspect-square w-full overflow-hidden bg-slate-50"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {displayImage ? (
          <>
            {/* Main Image - Always present */}
            <motion.div
              key="main-image"
              initial={{ opacity: 1 }}
              animate={{ opacity: isHovered && hoverImage ? 0 : 1 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={urlFor(displayImage).width(600).height(600).url()}
                alt={t(product.title_en, product.title_ar)}
                fill
                sizes="(max-width: 768px) 280px, 320px"
                loading={priority ? "eager" : "lazy"}
                priority={priority}
                fetchPriority={priority ? "high" : "auto"}
                className={cn(
                  "object-center transition-transform duration-700 ease-out",
                  product.image ? "object-cover group-hover:scale-110" : "object-contain p-8"
                )}
              />
            </motion.div>
            {/* Hover Image - Only when hovering and available */}
            {hoverImage && (
              <motion.div
                key="hover-image"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={urlFor(hoverImage).width(600).height(600).url()}
                  alt={t(product.title_en, product.title_ar)}
                  fill
                  sizes="(max-width: 768px) 280px, 320px"
                  className="object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out"
                />
              </motion.div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
            {t('No Image', 'لا توجد صورة')}
          </div>
        )}
        {/* Add to Cart Button Overlay - hidden when closed */}
        {!catalogOnly && (
        <motion.div
          className="absolute bottom-3 right-3 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto"
          initial={false}
        >
          <motion.button
            onClick={handleAddToCart}
            className="relative bg-black shadow-2xl rounded-full h-11 w-11 flex items-center justify-center cursor-pointer pointer-events-auto"
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
              <Plus className="w-5 h-5 text-white shrink-0" />
            </motion.div>
          </motion.button>
        </motion.div>
        )}
      </div>

      <div className="p-5 flex flex-col grow">
        <h3 className="font-black text-xl leading-tight mb-2 tracking-tight group-hover:text-primary transition-colors">
          {t(product.title_en, product.title_ar)}
        </h3>

        <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed grow">
          {t(product.description_en || '', product.description_ar || '')}
        </p>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 min-h-[44px]">
          <div className="flex flex-wrap gap-1.5">
            {product.dietaryTags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-2 py-0.5 bg-slate-100/50 text-slate-500 border-none font-bold uppercase tracking-wider">
                {tag}
              </Badge>
            ))}
          </div>
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
                <div className={`flex items-baseline gap-1 ${priceColor}`}>
                  <span className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
                    {hasSpecialPrice ? product.specialPrice : product.price}
                  </span>
                  <span className="text-base md:text-lg font-bold opacity-70 leading-none">
                    {formatCurrency(product.currency)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
