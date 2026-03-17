'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Product, ProductVariantGroup } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import type { OrderTypeOptions, CartTenant } from '@/components/Cart/CartContext'
import { Button } from '@/components/ui/button'
import { X, Star, Tag, Check, Plus, Minus, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { getSaleUnitLabel, isWeightBasedUnit, WEIGHT_PRESETS_KG, WEIGHT_PRESETS_100G, WEIGHT_MIN, WEIGHT_STEP } from '@/lib/sale-units'
import { cn } from '@/lib/utils'
import { getVariantOptionModifier } from '@/lib/cart-price'
import { isProductUnavailable } from '@/lib/product-availability'

interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  layoutPrefix?: string
  restaurantLogo?: any
  /** When true, product is view-only (catalog); hide Add to Cart. */
  catalogOnly?: boolean
  /** For single-business cart: pass when adding from menu page. */
  tenantContext?: CartTenant
  orderTypeOptions?: OrderTypeOptions | null
  catalogHidePrices?: boolean
}

export function ProductModal({ product, isOpen, onClose, layoutPrefix = 'product', restaurantLogo, catalogOnly = false, tenantContext, orderTypeOptions, catalogHidePrices = false }: ProductModalProps) {
  const { t, lang } = useLanguage()
  const { addToCart } = useCart()
  /** Add-on key -> quantity (0 = not selected). Allows e.g. "Bread x3". */
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({})
  const [selectedVariants, setSelectedVariants] = useState<(number | undefined)[]>([])
  const [isHovered, setIsHovered] = useState(false)
  /** For weight-based products (kg, g): selected weight. For kg: value in kg. For g: value = number of 100g. */
  const [weightQty, setWeightQty] = useState(1)

  useEffect(() => {
    if (product?.variants?.length) {
      const initial = product.variants.map((group) => {
        const defaultIdx = group.options?.findIndex((o) => o.isDefault === true)
        return defaultIdx >= 0 ? defaultIdx : undefined
      })
      setSelectedVariants(initial)
    } else {
      setSelectedVariants([])
    }
  }, [product?._id, product?.variants?.length])

  const isWeightProduct = isWeightBasedUnit(product?.saleUnit)
  const weightPresets = product?.saleUnit === 'g' ? WEIGHT_PRESETS_100G : WEIGHT_PRESETS_KG

  if (!product) return null

  const unavailable = isProductUnavailable(product)
  const hasSpecialPrice = product.specialPrice &&
    (!product.specialPriceExpires || new Date(product.specialPriceExpires) > new Date())

  const hoverImage = product.additionalImages && product.additionalImages.length > 0
    ? product.additionalImages[0]
    : null

  const selectedVariantImage =
    product.variants && selectedVariants.length > 0
      ? (() => {
          for (let gi = 0; gi < product.variants.length; gi++) {
            const oi = selectedVariants[gi]
            if (oi !== undefined) {
              const option = product.variants[gi].options?.[oi]
              if (option?.image?.asset?._ref) return option.image
            }
          }
          return null
        })()
      : null
  const displayImage = selectedVariantImage || product.image || restaurantLogo

  const basePrice = hasSpecialPrice ? product.specialPrice! : product.price
  const addOnPrice = Object.entries(addOnQuantities).reduce((sum, [addOnKey, qty]) => {
    if (qty <= 0) return sum
    const addOn = product.addOns?.find(a =>
      a._key === addOnKey ||
      `${a.name_en}-${a.price}` === addOnKey
    )
    return sum + (addOn?.price || 0) * qty
  }, 0)
  let variantPrice = 0
  const variantCount = product.variants?.length ?? 0
  if (variantCount > 0) {
    product.variants!.forEach((group, gi) => {
      const sel = selectedVariants[gi]
      if (sel !== undefined) {
        const option = group.options?.[sel]
        if (option) variantPrice += getVariantOptionModifier(option)
      }
    })
  }
  const baseUnitPrice = basePrice + addOnPrice + variantPrice
  const effectiveQty = isWeightProduct ? Math.max(WEIGHT_MIN, weightQty) : 1
  const totalPrice = isWeightProduct ? baseUnitPrice * effectiveQty : baseUnitPrice
  const shouldHidePrice = catalogOnly && (catalogHidePrices || product.hidePrice)

  const hasVariants = variantCount > 0
  const isGroupRequired = (group: ProductVariantGroup) => group.required === true
  const variantsComplete =
    !hasVariants ||
    (selectedVariants.length === variantCount &&
      product.variants!.every((group, gi) => !isGroupRequired(group) || selectedVariants[gi] !== undefined))

  const changeAddOnQuantity = (addOnKey: string, delta: number) => {
    setAddOnQuantities((prev) => {
      const current = prev[addOnKey] ?? 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        const { [addOnKey]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [addOnKey]: next }
    })
  }

  const setVariant = (groupIndex: number, optionIndex: number) => {
    setSelectedVariants(prev => {
      const len = product.variants?.length ?? 0
      const next: (number | undefined)[] = prev.slice(0, len)
      while (next.length < len) next.push(undefined)
      const current = next[groupIndex]
      next[groupIndex] = current === optionIndex ? undefined : optionIndex
      return next
    })
  }

  const handleAddToCart = () => {
    if (unavailable) return
    const selectedAddOns = Object.entries(addOnQuantities).flatMap(([key, qty]) =>
      qty > 0 ? Array(qty).fill(key) : []
    )
    const variantIndices = hasVariants ? selectedVariants.filter((v): v is number => v !== undefined) : undefined
    const qty = isWeightProduct ? Math.max(WEIGHT_MIN, weightQty) : 1
    addToCart(product, selectedAddOns, variantIndices, tenantContext, orderTypeOptions ?? undefined, qty)
    setAddOnQuantities({})
    setSelectedVariants([])
    setWeightQty(1)
    onClose()
  }

  const handleClose = () => {
    setAddOnQuantities({})
    setSelectedVariants([])
    setWeightQty(1)
    setIsHovered(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
      />
      <div
        className="fixed inset-x-0 bottom-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:max-w-md bg-white md:rounded-[32px] rounded-t-[24px] overflow-hidden z-[60] shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]"
      >
            {/* Square image: full square visible, mobile-first */}
            <div
              className="relative w-full aspect-square max-h-[45vh] md:max-h-[320px] shrink-0 bg-slate-100 flex items-center justify-center overflow-hidden"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {displayImage ? (
                <>
                  <div
                    key="main-image"
                    style={{ opacity: isHovered && hoverImage ? 0 : 1 }}
                    className="absolute inset-0 transition-opacity duration-200"
                  >
                    <Image
                      src={urlFor(displayImage).width(800).height(800).url()}
                      alt={t(product.title_en, product.title_ar)}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 512px"
                      placeholder="blur"
                      blurDataURL={SHIMMER_PLACEHOLDER}
                      className="object-cover object-center"
                    />
                  </div>
                  {hoverImage && (
                    <div
                      key="hover-image"
                      style={{ opacity: isHovered ? 1 : 0 }}
                      className="absolute inset-0 transition-opacity duration-200"
                    >
                      <Image
                        src={urlFor(hoverImage).width(800).height(800).url()}
                        alt={t(product.title_en, product.title_ar)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 512px"
                        placeholder="blur"
                        blurDataURL={SHIMMER_PLACEHOLDER}
                        className="object-cover object-center"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  {t('No Image', 'لا توجد صورة')}
                </div>
              )}

              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {unavailable && (
                  <Badge className="bg-slate-500/90 text-white border-none font-black px-2.5 py-1 shadow-lg text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {t('Unavailable', 'غير متوفر')}
                  </Badge>
                )}
                {product.isPopular && !unavailable && (
                  <Badge className="bg-amber-400 text-amber-950 border-none font-black px-2.5 py-1 shadow-lg text-[10px] uppercase tracking-wider">
                    <Star className="w-3 h-3 fill-current mr-1" />
                    {t('Popular', 'الأكثر طلباً')}
                  </Badge>
                )}
                {hasSpecialPrice && !unavailable && (
                  <Badge className="bg-red-500 text-white border-none font-black px-2.5 py-1 shadow-lg text-[10px] uppercase tracking-wider">
                    <Tag className="w-3 h-3 fill-current mr-1" />
                    {t('Offer', 'عرض')}
                  </Badge>
                )}
              </div>

              <Button
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 rounded-full bg-white/95 backdrop-blur-sm hover:bg-white shadow-lg h-10 w-10 border-none md:h-11 md:w-11"
                onClick={handleClose}
                aria-label={t('Close', 'إغلاق')}
              >
                <X className="h-5 w-5 text-slate-900 md:h-6 md:w-6" />
              </Button>
            </div>

            {/* Scrollable body: title, tags, variants, add-ons, description */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-32 pt-4 md:px-6 md:pb-36 md:pt-5">
              <h2 className="text-xl font-black tracking-tight mb-2 text-slate-900 leading-tight md:text-2xl">
                {t(product.title_en, product.title_ar)}
              </h2>
              {product.dietaryTags && product.dietaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {product.dietaryTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-slate-200 text-slate-500">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Variants - compact, easy to tap on mobile */}
              {product.variants && product.variants.length > 0 && (
                <section className="mb-5" aria-label={t('Options', 'الخيارات')}>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    {t('Choose options', 'اختر الخيارات')}
                  </h3>
                  <div className="space-y-4">
                    {product.variants.map((group, gi) => (
                      <div key={gi}>
                        <p className="text-xs font-bold text-slate-600 mb-2">
                          {lang === 'ar' ? group.name_ar : group.name_en}
                          {!isGroupRequired(group) && (
                            <span className="font-normal text-slate-400 ml-1">({t('Optional', 'اختياري')})</span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.options?.map((option, oi) => {
                            const isSelected = selectedVariants[gi] === oi
                            const label = lang === 'ar' ? option.label_ar : option.label_en
                            const modifier = getVariantOptionModifier(option)
                            const regularModifier = option.priceModifier ?? 0
                            const hasVariantSpecial = typeof option.specialPriceModifier === 'number' &&
                              (!option.specialPriceModifierExpires || new Date(option.specialPriceModifierExpires) > new Date())
                            return (
                              <button
                                key={oi}
                                type="button"
                                onClick={() => setVariant(gi, oi)}
                                className={cn(
                                  'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all min-h-[44px] touch-manipulation',
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 active:bg-slate-50'
                                )}
                              >
                                <span>{label}</span>
                                {!shouldHidePrice && modifier !== 0 && (
                                  <span className="opacity-90 text-xs">
                                    {hasVariantSpecial && regularModifier !== modifier && (
                                      <span className="line-through opacity-70 mr-0.5">
                                        {regularModifier > 0 ? `+${regularModifier}` : regularModifier}
                                      </span>
                                    )}
                                    {modifier > 0 ? `+${modifier}` : modifier} {formatCurrency(product.currency)}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Add-ons - list with quantity counter */}
              {product.addOns && product.addOns.length > 0 && (
                <section className="mb-5" aria-label={t('Add-ons', 'إضافات')}>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    {t('Add-ons', 'إضافات')}
                  </h3>
                  <div className="space-y-2">
                    {product.addOns.map((addOn) => {
                      const addOnKey = addOn._key || `${addOn.name_en}-${addOn.price}`
                      const qty = addOnQuantities[addOnKey] ?? 0
                      const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
                      const priceLabel = shouldHidePrice ? '' : (addOn.price === 0 ? t('Free', 'مجاني') : `+${addOn.price} ${formatCurrency(product.currency)}`)
                      return (
                        <div
                          key={addOnKey}
                          className={cn(
                            'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all min-h-[48px] touch-manipulation',
                            qty > 0 ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="font-bold text-sm truncate text-left" style={{ color: qty > 0 ? 'white' : undefined }}>
                              {addOnName}
                            </span>
                            <span className="text-xs shrink-0" style={{ color: qty > 0 ? 'rgba(255,255,255,0.9)' : undefined }}>
                              {priceLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => changeAddOnQuantity(addOnKey, -1)}
                              className={cn(
                                'flex size-9 items-center justify-center rounded-lg border-2 transition-colors',
                                qty > 0
                                  ? 'border-white/80 text-white hover:bg-white/20'
                                  : 'border-slate-300 text-slate-400 hover:bg-slate-100'
                              )}
                              aria-label={t('Decrease', 'تقليل')}
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="min-w-[1.75rem] text-center font-bold text-sm tabular-nums" style={{ color: qty > 0 ? 'white' : undefined }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeAddOnQuantity(addOnKey, 1)}
                              className={cn(
                                'flex size-9 items-center justify-center rounded-lg border-2 transition-colors',
                                qty > 0
                                  ? 'border-white/80 text-white hover:bg-white/20'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                              )}
                              aria-label={t('Increase', 'زيادة')}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Weight selector for kg/g products (greengrocery, produce) */}
              {!catalogOnly && isWeightProduct && (
                <section className="mb-5" aria-label={t('Choose weight', 'اختر الوزن')}>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    {product.saleUnit === 'kg'
                      ? t('How much? (kg)', 'كم؟ (كيلو)')
                      : t('How much? (100g units)', 'كم؟ (وحدات 100 غرام)')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {weightPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWeightQty(preset)}
                        className={cn(
                          'flex min-h-[44px] min-w-[52px] touch-manipulation items-center justify-center rounded-xl border-2 px-4 text-sm font-bold transition-all',
                          weightQty === preset
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 active:bg-slate-50'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeightQty((q) => Math.max(WEIGHT_MIN, q - WEIGHT_STEP))}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:border-slate-300 active:bg-slate-50"
                      aria-label={t('Decrease', 'تقليل')}
                    >
                      <Minus className="size-5" />
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={WEIGHT_MIN}
                      step={WEIGHT_STEP}
                      value={weightQty}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isNaN(v) && v >= WEIGHT_MIN) setWeightQty(v)
                      }}
                      className="h-11 w-24 rounded-xl border-2 border-slate-200 px-3 text-center font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setWeightQty((q) => q + WEIGHT_STEP)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:border-slate-300 active:bg-slate-50"
                      aria-label={t('Increase', 'زيادة')}
                    >
                      <Plus className="size-5" />
                    </button>
                    <span className="text-sm font-medium text-slate-500">
                      {product.saleUnit === 'kg' ? 'kg' : lang === 'ar' ? '× 100غ' : '× 100g'}
                    </span>
                  </div>
                </section>
              )}

              {/* Description & ingredients - optional, below the fold */}
              {(product.description_en || product.description_ar || (product.ingredients_en && product.ingredients_en.length > 0)) && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {(product.description_en || product.description_ar) && (
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        {t('Details', 'التفاصيل')}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {t(product.description_en || '', product.description_ar || '')}
                      </p>
                    </div>
                  )}
                  {product.ingredients_en && product.ingredients_en.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        {t('Ingredients', 'المكونات')}
                      </h3>
                      <ul className="space-y-1.5">
                        {(lang === 'ar' ? (product.ingredients_ar || product.ingredients_en) : product.ingredients_en).map((ingredient, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                            {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer: total always visible + Add to Cart */}
            {!catalogOnly && (
              <div className="shrink-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)]">
                <div className="px-4 py-3 flex items-center justify-between gap-4 md:px-6">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    {hasSpecialPrice && !unavailable && (
                      <span className="text-sm text-slate-400 line-through shrink-0">{product.price}</span>
                    )}
                    <span className={cn(
                      'text-2xl md:text-3xl font-black tracking-tight leading-none truncate',
                      unavailable ? 'text-slate-500' : hasSpecialPrice ? 'text-red-600' : 'text-slate-900'
                    )}>
                      {totalPrice}
                    </span>
                    <span className="text-base font-bold text-slate-500 shrink-0">{formatCurrency(product.currency)}</span>
                    {product.saleUnit && product.saleUnit !== 'piece' && (
                      <span className="text-sm font-medium text-slate-500 shrink-0">
                        / {getSaleUnitLabel(product.saleUnit, lang as 'en' | 'ar')}
                      </span>
                    )}
                  </div>
                  <Button
                    className="shrink-0 h-12 px-6 rounded-2xl font-black text-base md:h-14 md:px-8 md:text-lg shadow-lg"
                    onClick={handleAddToCart}
                    disabled={unavailable || !variantsComplete}
                    variant={unavailable ? 'secondary' : 'default'}
                  >
                    {unavailable
                      ? t('Unavailable', 'غير متوفر')
                      : !variantsComplete
                        ? t('Choose required', 'اختر الإلزامي')
                        : t('Add to Cart', 'إضافة إلى السلة')}
                  </Button>
                </div>
              </div>
            )}
      </div>
    </>
  )
}
