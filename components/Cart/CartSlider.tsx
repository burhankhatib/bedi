'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { useLanguage } from '@/components/LanguageContext'
import { useOrderAuth } from '@/lib/useOrderAuth'
import { OrderAuthGate } from '@/components/OrderAuthGate'
import { useToast } from '@/components/ui/ToastProvider'
import { Button } from '@/components/ui/button'
import { X, Plus, Minus, ShoppingCart, QrCode, MessageCircle, Edit2, RotateCcw, Trash2, Send, ChefHat, Store, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { getVariantOptionModifier } from '@/lib/cart-price'
import { UnifiedOrderDialog } from './UnifiedOrderDialog'
import type { ProductAddOn } from '@/app/types/menu'

/** Group selectedAddOns (array with duplicates) into { addOnKey, addOn, count } for display and totals. */
function groupAddOnsByKey(
  selectedAddOns: string[] | undefined,
  addOns: ProductAddOn[] | undefined
): Array<{ addOnKey: string; addOn: ProductAddOn; count: number }> {
  if (!selectedAddOns?.length) return []
  const countByKey: Record<string, number> = {}
  for (const key of selectedAddOns) {
    countByKey[key] = (countByKey[key] || 0) + 1
  }
  return Object.entries(countByKey)
    .map(([addOnKey, count]) => {
      const addOn = addOns?.find(
        (a) => a._key === addOnKey || `${a.name_en}-${a.price}` === addOnKey
      )
      return addOn ? { addOnKey, addOn, count } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
}

interface CartSliderProps {
  /** When false, only "Receive in Person" and "Delivery" are shown (no Dine-in). From tenant business type. */
  supportsDineIn?: boolean
  /** When false, hide "Receive in Person" (pickup) option. */
  supportsReceiveInPerson?: boolean
}

export function CartSlider({ supportsDineIn = true, supportsReceiveInPerson = true }: CartSliderProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const orderAuth = useOrderAuth()
  const {
    items,
    isOpen,
    setIsOpen,
    updateQuantity,
    updateNotes,
    removeFromCart,
    totalPrice,
    totalItems,
    clearCart,
    customerName,
    setCustomerName,
    tableNumber,
    setTableNumber,
    isReady,
    setIsReady,
    orderType,
    setOrderType,
    customerPhone,
    setCustomerPhone,
    deliveryAreaId,
    setDeliveryAreaId,
    deliveryAddress,
    setDeliveryAddress,
    deliveryLat,
    deliveryLng,
    setDeliveryLocation,
    clearDeliveryLocation,
    deliveryFee,
    setDeliveryFee,
    scheduledFor,
    setScheduledFor,
    tenantSlug,
    cartTenant,
    orderTypeOptions,
    lockedTableNumber,
  } = useCart()
  const { t, lang } = useLanguage()
  // Prefill phone from Clerk verified phone when available and cart phone is empty
  useEffect(() => {
    if (orderAuth.hasVerifiedPhone && orderAuth.verifiedPhoneValue && !customerPhone) {
      setCustomerPhone(orderAuth.verifiedPhoneValue)
    }
  }, [orderAuth.hasVerifiedPhone, orderAuth.verifiedPhoneValue, customerPhone, setCustomerPhone])
  const [showQRCode, setShowQRCode] = useState(false)
  const [orderData, setOrderData] = useState<string>('')
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false)
  const [isSendingOrder, setIsSendingOrder] = useState(false)

  const isRTL = lang === 'ar'

  const getOrderData = () => {
    return items.map((item) => {
      const hasSpecialPrice =
        item.specialPrice &&
        (!item.specialPriceExpires ||
          new Date(item.specialPriceExpires) > new Date())
      const basePrice = hasSpecialPrice ? item.specialPrice! : item.price

      // Calculate add-on prices
      const addOnPrice = (item.selectedAddOns || []).reduce((sum, addOnKey) => {
        const addOn = item.addOns?.find(a =>
          a._key === addOnKey ||
          `${a.name_en}-${a.price}` === addOnKey
        )
        return sum + (addOn?.price || 0)
      }, 0)

      let variantPrice = 0
      const variantParts: string[] = []
      if (item.variants?.length && item.selectedVariants?.length) {
        item.variants.forEach((group, gi) => {
          const optionIndex = item.selectedVariants![gi]
          if (optionIndex === undefined) return
          const option = group.options?.[optionIndex]
          if (option) {
            variantPrice += getVariantOptionModifier(option)
            const groupName = lang === 'ar' ? group.name_ar : group.name_en
            const optionLabel = lang === 'ar' ? option.label_ar : option.label_en
            variantParts.push(`${groupName}: ${optionLabel}`)
          }
        })
      }
      const variantText = variantParts.join(', ')
      const itemPrice = basePrice + addOnPrice + variantPrice
      const itemTotal = itemPrice * item.quantity

      const addOnsList = groupAddOnsByKey(item.selectedAddOns, item.addOns)
        .map(({ addOn, count }) => {
          const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
          if (count === 1) return addOn.price > 0 ? `${addOnName} (+${addOn.price})` : addOnName
          const total = addOn.price * count
          return addOn.price > 0 ? `${addOnName} x${count} (+${total})` : `${addOnName} x${count}`
        })
        .join(', ')
      const extras = [variantText, addOnsList].filter(Boolean).join(' · ')

      return {
        quantity: item.quantity,
        title: lang === 'ar' ? item.title_ar : item.title_en,
        price: itemPrice,
        total: itemTotal,
        currency: item.currency,
        notes: item.notes || '',
        addOns: extras || '',
      }
    })
  }

  const formatOrderForWhatsApp = () => {
    const orderLines = items.map((item) => {
      const hasSpecialPrice =
        item.specialPrice &&
        (!item.specialPriceExpires ||
          new Date(item.specialPriceExpires) > new Date())
      const basePrice = hasSpecialPrice ? item.specialPrice! : item.price

      const addOnPrice = (item.selectedAddOns || []).reduce((sum, addOnKey) => {
        const addOn = item.addOns?.find(a =>
          a._key === addOnKey ||
          `${a.name_en}-${a.price}` === addOnKey
        )
        return sum + (addOn?.price || 0)
      }, 0)

      let variantPrice = 0
      const variantPartsAr: string[] = []
      if (item.variants?.length && item.selectedVariants?.length) {
        item.variants.forEach((group, gi) => {
          const optionIndex = item.selectedVariants![gi]
          if (optionIndex === undefined) return
          const option = group.options?.[optionIndex]
          if (option) {
            variantPrice += getVariantOptionModifier(option)
            variantPartsAr.push(`${group.name_ar}: ${option.label_ar}`)
          }
        })
      }
      const itemPrice = basePrice + addOnPrice + variantPrice
      const itemTotal = itemPrice * item.quantity
      const title = item.title_ar || item.title_en

      const addOnsText = groupAddOnsByKey(item.selectedAddOns, item.addOns)
        .map(({ addOn, count }) => {
          if (count === 1) return addOn.price > 0 ? `${addOn.name_ar} (+${addOn.price})` : addOn.name_ar
          const total = addOn.price * count
          return addOn.price > 0 ? `${addOn.name_ar} x${count} (+${total})` : `${addOn.name_ar} x${count}`
        })
        .join('، ')
      const variantTextAr = variantPartsAr.join('، ')
      const extrasAr = [variantTextAr, addOnsText].filter(Boolean).join(' · ')

      let line = `${item.quantity}x ${title}`
      if (extrasAr) {
        line += ` (${extrasAr})`
      }
      line += ` - ${itemTotal.toFixed(2)} ${formatCurrency(item.currency)}`
      if (item.notes) {
        line += `\n   📝 ${item.notes}`
      }
      return line
    })

    const customerInfo = customerName
      ? `العميل: ${customerName}${tableNumber ? ` | الطاولة: ${tableNumber}` : ''}\n`
      : tableNumber
        ? `الطاولة: ${tableNumber}\n`
        : ''

    const header = `🍽️ طلب\n${'='.repeat(20)}\n${customerInfo}\n`
    const body = orderLines.join('\n')
    const total = `\n${'='.repeat(20)}\nالمجموع: ${totalPrice.toFixed(2)} ${formatCurrency(items[0]?.currency)}`

    return encodeURIComponent(header + body + total)
  }

  const handleReady = () => {
    setShowUnifiedDialog(true)
  }

  const handleEditCustomerInfo = () => {
    setShowUnifiedDialog(true)
  }

  const handleReceiveInPersonSubmit = (name: string, phone: string, scheduleStr?: string) => {
    setCustomerName(name)
    setCustomerPhone(phone)
    setScheduledFor(scheduleStr)
    setTableNumber('')
    setOrderType('receive-in-person')
    setIsReady(true)
  }

  const handleDineInSubmit = (name: string, table: string, phone: string) => {
    setCustomerName(name)
    setTableNumber(table)
    setCustomerPhone(phone)
    setScheduledFor(undefined)
    setOrderType('dine-in')
    setIsReady(true)
  }

  const handleDeliverySubmit = (name: string, phone: string, areaId: string, address: string, fee: number, scheduleStr?: string) => {
    setCustomerName(name)
    setCustomerPhone(phone)
    setDeliveryAreaId(areaId)
    setDeliveryAddress(address)
    setDeliveryFee(fee)
    setScheduledFor(scheduleStr)
    setOrderType('delivery')
    setIsReady(true)
  }

  const handleSendOrder = async () => {
    setIsSendingOrder(true)

    try {
      // Prepare order data for API
      const orderItems = items.map((item) => {
        const hasSpecialPrice =
          item.specialPrice &&
          (!item.specialPriceExpires ||
            new Date(item.specialPriceExpires) > new Date())
        const basePrice = hasSpecialPrice ? item.specialPrice! : item.price

        const addOnPrice = (item.selectedAddOns || []).reduce((sum, addOnKey) => {
          const addOn = item.addOns?.find(a =>
            a._key === addOnKey ||
            `${a.name_en}-${a.price}` === addOnKey
          )
          return sum + (addOn?.price || 0)
        }, 0)

        let variantPrice = 0
        const variantParts: string[] = []
        if (item.variants?.length && item.selectedVariants?.length) {
          item.variants.forEach((group, gi) => {
            const optionIndex = item.selectedVariants![gi]
            if (optionIndex === undefined) return
            const option = group.options?.[optionIndex]
            if (option) {
              variantPrice += getVariantOptionModifier(option)
              const groupName = lang === 'ar' ? group.name_ar : group.name_en
              const optionLabel = lang === 'ar' ? option.label_ar : option.label_en
              variantParts.push(`${groupName}: ${optionLabel}`)
            }
          })
        }
        const variantStr = variantParts.join(', ')
        const addOnsList = groupAddOnsByKey(item.selectedAddOns, item.addOns)
          .map(({ addOn, count }) => {
            const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
            if (count === 1) return addOn.price > 0 ? `${addOnName} (+${addOn.price})` : addOnName
            const total = addOn.price * count
            return addOn.price > 0 ? `${addOnName} x${count} (+${total})` : `${addOnName} x${count}`
          })
          .join(', ')
        const productName = [lang === 'ar' ? item.title_ar : item.title_en, variantStr].filter(Boolean).join(' · ')

        const itemPrice = basePrice + addOnPrice + variantPrice
        const itemTotal = itemPrice * item.quantity

        return {
          productId: item._id,
          productName,
          quantity: item.quantity,
          price: itemPrice,
          total: itemTotal,
          notes: item.notes || '',
          addOns: addOnsList,
        }
      })

      const finalTotal = orderType === 'delivery' ? totalPrice + deliveryFee : totalPrice

      const orderPayload: any = {
        orderType,
        customerName,
        items: orderItems,
        subtotal: totalPrice,
        totalAmount: finalTotal,
        currency: items[0]?.currency || 'ILS',
      }
      if (tenantSlug) orderPayload.tenantSlug = tenantSlug
      if (scheduledFor) orderPayload.scheduledFor = scheduledFor

      if (orderType === 'dine-in') {
        orderPayload.tableNumber = tableNumber
        orderPayload.customerPhone = customerPhone
      } else if (orderType === 'receive-in-person') {
        orderPayload.customerPhone = customerPhone
      } else if (orderType === 'delivery') {
        orderPayload.customerPhone = customerPhone
        orderPayload.deliveryAreaId = deliveryAreaId
        orderPayload.deliveryAddress = deliveryAddress
        orderPayload.deliveryFee = deliveryFee
        if (deliveryLat != null && deliveryLng != null && Number.isFinite(deliveryLat) && Number.isFinite(deliveryLng)) {
          orderPayload.deliveryLat = deliveryLat
          orderPayload.deliveryLng = deliveryLng
        }
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      })

      if (response.status === 403) {
        window.location.href = '/suspended?type=customer'
        return
      }
      if (!response.ok) {
        throw new Error('Failed to create order')
      }

      const result = await response.json()

      showToast(
        `Order #${result.orderNumber} sent successfully!`,
        `تم إرسال الطلب #${result.orderNumber} بنجاح!`,
        'success'
      )

      clearCart()
      setIsOpen(false)

      if (result.trackingToken && tenantSlug) {
        router.push(`/t/${tenantSlug}/track/${result.trackingToken}`)
      } else if (result.orderId && tenantSlug && customerPhone?.trim()) {
        router.push(`/t/${tenantSlug}/order/${result.orderId}?phone=${encodeURIComponent(customerPhone)}`)
      }
    } catch (error) {
      console.error('Error sending order:', error)
      showToast(
        'Failed to send order. Please try again.',
        'فشل إرسال الطلب. يرجى المحاولة مرة أخرى.',
        'error'
      )
    } finally {
      setIsSendingOrder(false)
    }
  }

  const handleNewOrder = () => {
    clearCart()
    setCustomerName('')
    setTableNumber('')
    setIsReady(false)
    setIsOpen(false)
  }

  const handleQRCode = () => {
    setIsOpen(false)
    const orderData = getOrderData()
    const orderJson = JSON.stringify({
      items: orderData,
      total: totalPrice,
      currency: items[0]?.currency || 'ILS',
      timestamp: new Date().toISOString(),
      customerName: customerName || '',
      tableNumber: tableNumber || '',
    })
    const encoded = encodeURIComponent(orderJson)
    const orderUrl = `${window.location.origin}/order?data=${encoded}`
    setOrderData(orderUrl)
    setTimeout(() => {
      setShowQRCode(true)
    }, 300)
  }

  const handleWhatsApp = () => {
    setIsOpen(false)
    const message = formatOrderForWhatsApp()
    const whatsappUrl = getWhatsAppUrl('+972546708508', message)
    if (whatsappUrl) {
      setTimeout(() => window.open(whatsappUrl, '_blank'), 300)
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isRTL ? 'left' : 'right'}
          className="w-full sm:max-w-md h-full flex flex-col p-0 border-none"
        >
          <SheetHeader className="p-6 border-b shrink-0 text-left rtl:text-right">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <SheetTitle className="flex items-center gap-2 text-xl font-black">
                  <ShoppingCart className="w-5 h-5" />
                  {customerName
                    ? `${t('Hello', 'مرحباً')}, ${customerName}!`
                    : t('Your Order', 'طلبك')
                  } ({totalItems})
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {t('Review and manage your order items', 'راجع وأدر عناصر طلبك')}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {cartTenant && items.length > 0 && (
            <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3">
              <Link
                href={`/t/${cartTenant.slug}`}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 transition-colors hover:bg-slate-100"
              >
                {cartTenant.logoRef && (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white">
                    <Image
                      src={urlFor({ asset: { _ref: cartTenant.logoRef } }).width(80).height(80).url()}
                      alt={cartTenant.name}
                      fill
                      sizes="40px"
                      className="object-contain"
                    />
                  </div>
                )}
                {!cartTenant.logoRef && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Store className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">{t('Ordering from', 'الطلب من')}</p>
                  <p className="font-bold text-slate-900 truncate">{cartTenant.name}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold text-lg">
                  {t('Your cart is empty', 'سلة التسوق فارغة')}
                </p>
                <Button
                  variant="link"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 text-primary font-bold"
                >
                  {t('Explore Menu', 'استعرض القائمة')}
                </Button>
              </div>
            ) : (
              <div className="p-4 space-y-4 pb-10">
                {items.map((item) => {
                  const hasSpecialPrice =
                    item.specialPrice &&
                    (!item.specialPriceExpires ||
                      new Date(item.specialPriceExpires) > new Date())
                  const basePrice = hasSpecialPrice ? item.specialPrice! : item.price

                  const addOnPrice = (item.selectedAddOns || []).reduce((sum, addOnKey) => {
                    const addOn = item.addOns?.find(a =>
                      a._key === addOnKey ||
                      `${a.name_en}-${a.price}` === addOnKey
                    )
                    return sum + (addOn?.price || 0)
                  }, 0)

                  let variantPrice = 0
                  if (item.variants?.length && item.selectedVariants?.length) {
                    item.variants.forEach((group, gi) => {
                      const optionIndex = item.selectedVariants![gi]
                      if (optionIndex === undefined) return
                      const option = group.options?.[optionIndex]
                      if (option) variantPrice += getVariantOptionModifier(option)
                    })
                  }

                  const itemPrice = basePrice + addOnPrice + variantPrice
                  const itemTotal = itemPrice * item.quantity

                  return (
                    <div
                      key={item.cartItemId}
                      className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative group"
                    >
                      <div className="flex gap-4">
                        {item.image && (
                          <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-50">
                            <Image
                              src={urlFor(item.image).width(160).height(160).url()}
                              alt={lang === 'ar' ? item.title_ar : item.title_en}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-black text-base line-clamp-1">
                              {lang === 'ar' ? item.title_ar : item.title_en}
                            </h4>
                            <button
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                            <div className="text-xs font-bold text-slate-500 mt-1 mb-1 space-y-0.5">
                              {groupAddOnsByKey(item.selectedAddOns, item.addOns).map(({ addOnKey, addOn, count }) => {
                                const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
                                const lineTotal = addOn.price * count
                                return (
                                  <div key={addOnKey} className="flex items-center gap-1">
                                    <span className="text-primary">+</span> {addOnName}
                                    {count > 1 && <span className="text-slate-500"> x{count}</span>}
                                    {addOn.price > 0 && (
                                      <span className="text-slate-400 font-medium">
                                        ({count > 1 ? lineTotal : addOn.price} {formatCurrency(item.currency)})
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <p className="text-sm font-bold text-slate-400 mb-3">
                            {itemPrice.toFixed(2)} {formatCurrency(item.currency)} × {item.quantity}
                          </p>

                          <div className="flex items-center justify-between gap-4 mt-auto">
                            <div className="flex items-center bg-slate-100 rounded-2xl p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm"
                                onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              >
                                {item.quantity === 1 ? (
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Minus className="w-4 h-4" />
                                )}
                              </Button>
                              <span className="font-black text-sm w-10 text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm"
                                onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              >
                                <Plus className="w-4 h-4 text-black" />
                              </Button>
                            </div>
                            <p className="font-black text-xl text-slate-900">
                              {itemTotal.toFixed(2)} {formatCurrency(item.currency)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('Note', 'ملاحظة')}:</span>
                          <Input
                            placeholder={t('Any requests?', 'أي طلبات؟')}
                            value={item.notes || ''}
                            onChange={(e) => updateNotes(item.cartItemId, e.target.value)}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-0 px-0 placeholder:text-slate-300 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t bg-white p-6 pb-8 space-y-4 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
              {orderAuth.needsSignIn || orderAuth.needsPhoneVerification ? (
                <OrderAuthGate
                  variant="inline"
                  tenantSlug={tenantSlug ?? undefined}
                  returnTo={tenantSlug ? `/t/${tenantSlug}?openCart=1` : '/'}
                >
                  <div className="hidden" />
                </OrderAuthGate>
              ) : !isReady ? (
                <>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                        {t('Total Amount', 'المجموع الكلي')}
                      </p>
                      <p className="font-black text-3xl leading-none text-slate-900">
                        {totalPrice.toFixed(2)} <span className="text-lg opacity-50 font-bold">{formatCurrency(items[0]?.currency)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-md">
                        {totalItems} {t('Items', 'أصناف')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleReady}
                    className="w-full h-16 rounded-[24px] font-black text-lg bg-black hover:bg-slate-800 shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
                  >
                    {t('READY!', 'جاهز!')}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-[24px] p-4 flex items-center justify-between border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('Order For', 'الطلب باسم')}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 truncate">
                          {customerName || t('Guest', 'ضيف')}
                        </p>
                        {tableNumber && (
                          <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {t('Table', 'طاولة')} {tableNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEditCustomerInfo}
                      className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Show delivery details for delivery orders */}
                  {orderType === 'delivery' && deliveryFee > 0 && (
                    <div className="space-y-2 text-sm px-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{t('Subtotal', 'المجموع الفرعي')}</span>
                        <span className="font-bold">
                          {totalPrice.toFixed(2)} {formatCurrency(items[0]?.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{t('Delivery Fee', 'رسوم التوصيل')}</span>
                        <span className="font-bold">
                          {deliveryFee.toFixed(2)} {formatCurrency(items[0]?.currency)}
                        </span>
                      </div>
                      <div className="border-t pt-2"></div>
                    </div>
                  )}

                  <div className="flex justify-between items-center px-1">
                    <span className="font-black text-slate-400 text-sm uppercase tracking-widest">{t('Total', 'المجموع')}</span>
                    <span className="font-black text-2xl">
                      {(orderType === 'delivery' ? totalPrice + deliveryFee : totalPrice).toFixed(2)} {formatCurrency(items[0]?.currency)}
                    </span>
                  </div>

                  {/* Main SEND Button */}
                  <Button
                    onClick={handleSendOrder}
                    disabled={isSendingOrder}
                    className="w-full h-16 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-[0.98] transition-all"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isSendingOrder
                      ? t('Sending...', 'جارٍ الإرسال...')
                      : t('SEND ORDER', 'إرسال الطلب')
                    }
                  </Button>

                  {/* QR code temporarily disabled – only SEND ORDER sends to Order Management. To re-enable: show when orderType === 'dine-in'. */}
                  {false && orderType === 'dine-in' && (
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        onClick={handleQRCode}
                        variant="outline"
                        className="h-12 rounded-xl font-bold border-2 active:scale-[0.98] transition-all"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        {t('QR', 'رمز')}
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleNewOrder}
                    variant="ghost"
                    className="w-full h-12 rounded-xl font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t('New Order', 'طلب جديد')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full relative shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQRCode(false)}
              className="absolute top-6 right-6 rounded-full bg-slate-50"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black mb-2">{t('Your Order QR Code', 'رمز الطلب')}</h3>
              <p className="text-slate-500 text-sm font-medium px-4">
                {t('Show this QR code to the waiter to process your order', 'اعرض هذا الرمز للنادل لمعالجة طلبك')}
              </p>
            </div>

            <div className="flex justify-center mb-8 bg-slate-50 p-8 rounded-[32px] border border-slate-100">
              <div className="bg-white p-4 rounded-2xl shadow-sm">
                <QRCodeSVG
                  value={orderData}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-[24px] p-5 mb-8 space-y-4 border border-slate-100">
              {customerName && (
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Customer', 'العميل')}:</span>
                  <span className="font-black text-sm">{customerName}</span>
                  {tableNumber && (
                    <span className="ml-auto bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {t('Table', 'طاولة')} {tableNumber}
                    </span>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">{t('Total Price', 'المجموع')}</span>
                <span className="font-black text-xl">
                  {totalPrice.toFixed(2)} {formatCurrency(items[0]?.currency)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  window.open(orderData, '_blank')
                }}
                variant="outline"
                className="flex-1 h-14 rounded-2xl font-black border-2 border-slate-900 text-slate-900 hover:bg-slate-50"
              >
                {t('View Details', 'عرض التفاصيل')}
              </Button>
              <Button
                onClick={() => setShowQRCode(false)}
                className="flex-1 h-14 rounded-2xl font-black bg-black text-white"
              >
                {t('Close', 'إغلاق')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Order Dialog - Name → Type → Details */}
      <UnifiedOrderDialog
        open={showUnifiedDialog}
        onOpenChange={setShowUnifiedDialog}
        onReceiveInPersonSubmit={handleReceiveInPersonSubmit}
        onDineInSubmit={handleDineInSubmit}
        onDeliverySubmit={handleDeliverySubmit}
        initialName={customerName}
        initialPhone={customerPhone}
        tenantSlug={tenantSlug}
        supportsDineIn={orderTypeOptions?.supportsDineIn ?? supportsDineIn}
        supportsReceiveInPerson={orderTypeOptions?.supportsReceiveInPerson ?? supportsReceiveInPerson}
        hasDelivery={orderTypeOptions?.hasDelivery}
        lockedTableNumber={lockedTableNumber}
        deliveryLat={deliveryLat}
        deliveryLng={deliveryLng}
        setDeliveryLocation={setDeliveryLocation}
        clearDeliveryLocation={clearDeliveryLocation}
      />
    </>
  )
}
