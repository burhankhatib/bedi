'use client'

import { memo, useMemo } from 'react'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus, Minus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import {
  getSaleUnitLabel,
  isWeightBasedUnit,
  formatQuantityWithUnit,
  WEIGHT_STEP,
  WEIGHT_MIN,
} from '@/lib/sale-units'
import {
  groupAddOnsByKey,
  getCartLineUnitPrice,
  getCartLineTotal,
} from '@/lib/cart-line-calculations'
import type { CartItem } from './CartContext'

type TFn = (en: string, ar: string) => string

export const CartSliderLineItem = memo(function CartSliderLineItem({
  item,
  lang,
  t,
  onRemove,
  onUpdateQuantity,
  onUpdateNotes,
  isSharedCart,
  canEdit = true,
}: {
  item: CartItem
  lang: string
  t: TFn
  onRemove: (cartItemId: string) => void
  onUpdateQuantity: (cartItemId: string, quantity: number) => void
  onUpdateNotes: (cartItemId: string, notes: string) => void
  isSharedCart?: boolean
  canEdit?: boolean
}) {
  const isAr = lang === 'ar'
  const { unitPrice, lineTotal } = useMemo(
    () => ({
      unitPrice: getCartLineUnitPrice(item),
      lineTotal: getCartLineTotal(item),
    }),
    [item]
  )

  const weight = isWeightBasedUnit(item.saleUnit)
  const showTrashDecrement =
    weight ? item.quantity < WEIGHT_MIN + WEIGHT_STEP : item.quantity <= 1

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative group">
      <div className="flex gap-4">
        {item.image && (
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-50">
            <Image
              src={urlFor(item.image).width(160).height(160).url()}
              alt={isAr ? item.title_ar : item.title_en}
              fill
              sizes="80px"
              placeholder="blur"
              blurDataURL={SHIMMER_PLACEHOLDER}
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h4 className="font-black text-base line-clamp-1">
                {isAr ? item.title_ar : item.title_en}
              </h4>
              {isSharedCart && item.ownerName && (
                <div className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">
                    👤
                  </span>
                  {item.ownerName}
                </div>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => onRemove(item.cartItemId)}
                className="text-slate-300 hover:text-red-500 transition-colors"
                aria-label={t('Remove', 'إزالة')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {item.selectedAddOns && item.selectedAddOns.length > 0 && (
            <div className="text-xs font-bold text-slate-500 mt-1 mb-1 space-y-0.5">
              {groupAddOnsByKey(item.selectedAddOns, item.addOns).map(({ addOnKey, addOn, count }) => {
                const addOnName = isAr ? addOn.name_ar : addOn.name_en
                const lineAddOnTotal = addOn.price * count
                return (
                  <div key={addOnKey} className="flex items-center gap-1">
                    <span className="text-primary">+</span> {addOnName}
                    {count > 1 && <span className="text-slate-500"> x{count}</span>}
                    {addOn.price > 0 && (
                      <span className="text-slate-400 font-medium">
                        ({count > 1 ? lineAddOnTotal : addOn.price} {formatCurrency(item.currency)})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-sm font-bold text-slate-400 mb-3">
            {unitPrice.toFixed(2)} {formatCurrency(item.currency)}
            {item.saleUnit && item.saleUnit !== 'piece' &&
              ` / ${getSaleUnitLabel(item.saleUnit, lang as 'en' | 'ar')}`}
            {' × '}
            {formatQuantityWithUnit(item.quantity, item.saleUnit, lang as 'en' | 'ar')}
          </p>

          <div className="flex items-center justify-between gap-4 mt-auto">
            <div className="flex items-center bg-slate-100 rounded-2xl p-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canEdit}
                className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50"
                onClick={() => {
                  const step = weight ? WEIGHT_STEP : 1
                  const next = item.quantity - step
                  if (next < (weight ? WEIGHT_MIN : 1)) onRemove(item.cartItemId)
                  else onUpdateQuantity(item.cartItemId, Math.round(next * 100) / 100)
                }}
                aria-label={t('Decrease quantity', 'تقليل الكمية')}
              >
                {showTrashDecrement ? (
                  <Trash2 className="w-4 h-4 text-red-500" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
              </Button>
              <span className="font-black text-sm w-12 text-center tabular-nums">
                {formatQuantityWithUnit(item.quantity, item.saleUnit, lang as 'en' | 'ar')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canEdit}
                className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50"
                onClick={() => {
                  const step = weight ? WEIGHT_STEP : 1
                  onUpdateQuantity(item.cartItemId, Math.round((item.quantity + step) * 100) / 100)
                }}
                aria-label={t('Increase quantity', 'زيادة الكمية')}
              >
                <Plus className="w-4 h-4 text-black" />
              </Button>
            </div>
            <p className="font-black text-xl text-slate-900">
              {lineTotal.toFixed(2)} {formatCurrency(item.currency)}
              {item.saleUnit && item.saleUnit !== 'piece' && (
                <span className="text-sm font-medium text-slate-500">
                  {' '}
                  / {getSaleUnitLabel(item.saleUnit, lang as 'en' | 'ar')}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            {t('Note', 'ملاحظة')}:
          </span>
          <Input
            placeholder={t('Any requests?', 'أي طلبات؟')}
            value={item.notes || ''}
            disabled={!canEdit}
            onChange={(e) => onUpdateNotes(item.cartItemId, e.target.value)}
            className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 px-0 placeholder:text-slate-300 font-bold disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  )
})
