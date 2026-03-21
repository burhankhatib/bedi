'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useCart } from './CartContext'
import { useOrderAuth } from '@/lib/useOrderAuth'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Plus, Minus, ShoppingCart, QrCode, MessageCircle, Edit2, RotateCcw, Trash2, Send } from 'lucide-react'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { QRCodeSVG } from 'qrcode.react'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { getSaleUnitLabel, isWeightBasedUnit, formatQuantityWithUnit, WEIGHT_STEP, WEIGHT_MIN } from '@/lib/sale-units'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { getVariantOptionModifier } from '@/lib/cart-price'
import { getShopperFeeByItemCount, getShopperFeeExplanation } from '@/lib/shopper-fee'
import { UnifiedOrderDialog } from './UnifiedOrderDialog'
import { OrderType } from './CartContext'
import type { ProductAddOn } from '@/app/types/menu'

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

export function CartDrawer() {
  const router = useRouter()
  const { showToast } = useToast()
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
    deliveryAccuracyMeters,
    deliveryLocationSource,
    setDeliveryLocation,
    clearDeliveryLocation,
    deliveryFee,
    setDeliveryFee,
    deliveryFeePaidByBusiness,
    setDeliveryFeePaidByBusiness,
    scheduledFor,
    setScheduledFor,
    tenantSlug,
    cartTenant,
    deviceId,
    hostId,
  } = useCart()
  const orderAuth = useOrderAuth()
  const { t, lang } = useLanguage()

  const isSharedCart = orderType === 'dine-in' && !!tableNumber && !!cartTenant?.slug && !!deviceId
  const isHost = isSharedCart ? hostId === deviceId : true
  // Prefill phone from Clerk verified phone when available and cart phone is empty
  useEffect(() => {
    if (orderAuth.hasVerifiedPhone && orderAuth.verifiedPhoneValue && !customerPhone) {
      setCustomerPhone(orderAuth.verifiedPhoneValue)
    }
  }, [orderAuth.hasVerifiedPhone, orderAuth.verifiedPhoneValue, customerPhone, setCustomerPhone])

  // Prefill name from Clerk user data when available and cart name is empty
  useEffect(() => {
    if (orderAuth.clerkUser?.fullName && !customerName) {
      setCustomerName(orderAuth.clerkUser.fullName)
    } else if (orderAuth.clerkUser?.firstName && !customerName) {
      setCustomerName(orderAuth.clerkUser.firstName)
    }
  }, [orderAuth.clerkUser, customerName, setCustomerName])

  const [showQRCode, setShowQRCode] = useState(false)
  const [orderData, setOrderData] = useState<string>('')
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false)
  const [isSendingOrder, setIsSendingOrder] = useState(false)
  const [showHostConfirmDialog, setShowHostConfirmDialog] = useState(false)

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
    // Format in Arabic (RTL) with English numbers and prices
    const orderLines = items.map((item) => {
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

    // Header in Arabic
    const customerInfo = customerName
      ? `العميل: ${customerName}${tableNumber ? ` | الطاولة: ${tableNumber}` : ''}\n`
      : tableNumber
        ? `الطاولة: ${tableNumber}\n`
        : ''

    const header = `🍽️ طلب\n${'='.repeat(20)}\n${customerInfo}\n`
    const body = orderLines.join('\n')
    const isFreeDelivery =
      orderType === 'delivery' &&
      (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
    const shopperFee = orderType === 'delivery' && (cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup) ? getShopperFeeByItemCount(totalItems) : 0
    const finalTotal = orderType === 'delivery' ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) + shopperFee : totalPrice
    const total = `\n${'='.repeat(20)}\nالمجموع: ${finalTotal.toFixed(2)} ${formatCurrency(items[0]?.currency)}`

    // Always send in Arabic (RTL)
    return encodeURIComponent(header + body + total)
  }

  const handleReady = () => {
    setShowUnifiedDialog(true)
  }

  const handleReceiveInPersonSubmit = (name: string, phone: string, scheduleStr?: string) => {
    setCustomerName(name)
    setCustomerPhone(phone)
    setScheduledFor(scheduleStr)
    setTableNumber('')
    setDeliveryFeePaidByBusiness(false)
    setOrderType('receive-in-person')
    setIsReady(true)
  }

  const handleDineInSubmit = (name: string, table: string, phone: string, scheduleStr?: string) => {
    setCustomerName(name)
    setTableNumber(table)
    setCustomerPhone(phone)
    setScheduledFor(scheduleStr)
    setDeliveryFeePaidByBusiness(false)
    setOrderType('dine-in')
    setIsReady(true)
  }

  const handleDeliverySubmit = (
    name: string,
    phone: string,
    address: string,
    fee: number,
    scheduleStr?: string,
    paidByBusiness?: boolean
  ) => {
    setCustomerName(name)
    setCustomerPhone(phone)
    setDeliveryAddress(address)
    setDeliveryFee(fee)
    setDeliveryFeePaidByBusiness(paidByBusiness === true)
    setScheduledFor(scheduleStr)
    setOrderType('delivery')
    setIsReady(true)
  }

  const handleEditOrderInfo = () => {
    setShowUnifiedDialog(true)
  }

  const handleSendToKitchen = async () => {
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

      const isFreeDelivery =
        orderType === 'delivery' &&
        (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
      const shopperFee = orderType === 'delivery' && (cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup)
        ? getShopperFeeByItemCount(totalItems)
        : 0
      const orderPayload: Record<string, unknown> = {
        orderType,
        customerName,
        items: orderItems,
        subtotal: totalPrice,
        totalAmount: orderType === 'delivery' ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) + shopperFee : totalPrice,
        currency: items[0]?.currency || 'ILS',
      }
      const slugForOrder = tenantSlug ?? cartTenant?.slug
      if (slugForOrder) orderPayload.tenantSlug = slugForOrder
      if (scheduledFor) orderPayload.scheduledFor = scheduledFor

      if (orderType === 'dine-in') {
        orderPayload.tableNumber = tableNumber
        orderPayload.customerPhone = customerPhone
      } else if (orderType === 'receive-in-person') {
        orderPayload.customerPhone = customerPhone
      } else if (orderType === 'delivery') {
        orderPayload.customerPhone = customerPhone
        orderPayload.deliveryAddress = deliveryAddress
        orderPayload.deliveryFee = deliveryFee
        if (shopperFee > 0) {
          orderPayload.requiresPersonalShopper = true
          orderPayload.shopperFee = shopperFee
        }
        if (deliveryLat != null && deliveryLng != null && Number.isFinite(deliveryLat) && Number.isFinite(deliveryLng)) {
          orderPayload.deliveryLat = deliveryLat
          orderPayload.deliveryLng = deliveryLng
          if (deliveryAccuracyMeters != null) orderPayload.deliveryAccuracyMeters = deliveryAccuracyMeters
          if (deliveryLocationSource != null) orderPayload.deliveryLocationSource = deliveryLocationSource
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
        `Order #${result.orderNumber} sent to kitchen successfully!`,
        `تم إرسال الطلب #${result.orderNumber} إلى المطبخ بنجاح!`,
        'success'
      )

      clearCart()
      setIsOpen(false)

      const slugForRedirect =
        (typeof tenantSlug === 'string' && tenantSlug.trim()) ||
        (cartTenant?.slug && String(cartTenant.slug).trim()) ||
        (typeof result.siteSlug === 'string' && result.siteSlug.trim()) ||
        ''
      if (result.trackingToken && slugForRedirect) {
        router.replace(`/t/${slugForRedirect}/track/${result.trackingToken}`)
      } else if (result.orderId && slugForRedirect) {
        router.replace(`/t/${slugForRedirect}/order/${result.orderId}`)
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
    setIsOpen(false)
  }

  const handleQRCode = () => {
    setIsOpen(false)
    const orderDataItems = getOrderData()
    const isFreeDelivery = orderType === 'delivery' && (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
    const orderJson = JSON.stringify({
      items: orderDataItems,
      total: orderType === 'delivery' ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) : totalPrice,
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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  const shopperFee = orderType === 'delivery' && (cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup) ? getShopperFeeByItemCount(totalItems) : 0
  const isFreeDelivery = orderType === 'delivery' && (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
  const finalTotal = orderType === 'delivery' ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) + shopperFee : totalPrice

  return (
    <>
      <Drawer
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <DrawerContent
          className="!z-[200]"
          overlayClassName="!z-[200]"
          style={{
            maxHeight: '100vh',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          <DrawerHeader className="border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DrawerTitle className="flex items-center gap-2 text-xl font-black">
                  <ShoppingCart className="w-5 h-5" />
                  {customerName
                    ? `${t('Hello', 'مرحباً')}, ${customerName}!`
                    : t('Your Order', 'طلبك')
                  } ({totalItems})
                </DrawerTitle>
                <DrawerDescription className="mt-1">
                  {t('Review and manage your order items', 'راجع وأدر عناصر طلبك')}
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false)
                }}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DrawerHeader>

          <div
            className="flex flex-col flex-1 overflow-hidden min-h-0"
            style={{
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              touchAction: 'pan-y'
            }}
          >
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium text-lg">
                  {t('Your cart is empty', 'سلة التسوق فارغة')}
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex-1 overflow-y-auto min-h-0"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    flex: '1 1 auto',
                    minHeight: 0,
                    touchAction: 'pan-y'
                  }}
                >
                  <div className="p-4 space-y-4">
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

                      const itemPrice = basePrice + addOnPrice
                      const itemTotal = itemPrice * item.quantity
                      const canEdit = isHost || item.ownerId === deviceId

                      return (
                        <div
                          key={item.cartItemId}
                          className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100"
                        >
                          {item.image && (
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
                              <Image
                                src={urlFor(item.image).width(160).height(160).url()}
                                alt={lang === 'ar' ? item.title_ar : item.title_en}
                                fill
                                sizes="80px"
                                placeholder="blur"
                                blurDataURL={SHIMMER_PLACEHOLDER}
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div>
                              <h4 className="font-bold text-base mb-1 line-clamp-1">
                                {lang === 'ar' ? item.title_ar : item.title_en}
                              </h4>
                              {isSharedCart && item.ownerName && (
                                <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                  <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">
                                    👤
                                  </span>
                                  {item.ownerName}
                                </div>
                              )}
                            </div>
                            {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                              <div className="text-xs text-slate-600 mb-1 space-y-0.5">
                                {groupAddOnsByKey(item.selectedAddOns, item.addOns).map(({ addOnKey, addOn, count }) => {
                                  const addOnName = lang === 'ar' ? addOn.name_ar : addOn.name_en
                                  const lineTotal = addOn.price * count
                                  return (
                                    <div key={addOnKey} className="flex items-center gap-1">
                                      <span>+ {addOnName}</span>
                                      {count > 1 && <span className="text-slate-500"> x{count}</span>}
                                      {addOn.price > 0 && (
                                        <span className="text-slate-500">
                                          ({count > 1 ? lineTotal : addOn.price} {formatCurrency(item.currency)})
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <p className="text-sm text-slate-500 mb-2">
                              {itemPrice.toFixed(2)} {formatCurrency(item.currency)}
                              {item.saleUnit && item.saleUnit !== 'piece' && ` / ${getSaleUnitLabel(item.saleUnit, lang as 'en' | 'ar')}`}
                              {' × '}{formatQuantityWithUnit(item.quantity, item.saleUnit, lang as 'en' | 'ar')}
                            </p>
                            <div className="mb-2">
                              <Input
                                placeholder={t('Special requests...', 'طلبات خاصة...')}
                                value={item.notes || ''}
                                disabled={!canEdit}
                                onChange={(e) => updateNotes(item.cartItemId, e.target.value)}
                                className="text-sm h-9 bg-white disabled:opacity-50"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canEdit}
                                  className="h-8 w-8 rounded-lg disabled:opacity-50"
                                  onClick={() => {
                                    const isWeight = isWeightBasedUnit(item.saleUnit)
                                    const step = isWeight ? WEIGHT_STEP : 1
                                    const next = item.quantity - step
                                    if (next < (isWeight ? WEIGHT_MIN : 1)) removeFromCart(item.cartItemId)
                                    else updateQuantity(item.cartItemId, Math.round(next * 100) / 100)
                                  }}
                                >
                                  {(isWeightBasedUnit(item.saleUnit) ? item.quantity < WEIGHT_MIN + WEIGHT_STEP : item.quantity <= 1) ? (
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <Minus className="w-4 h-4" />
                                  )}
                                </Button>
                                <span className="font-bold text-sm w-12 text-center tabular-nums">
                                  {formatQuantityWithUnit(item.quantity, item.saleUnit, lang as 'en' | 'ar')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canEdit}
                                  className="h-8 w-8 rounded-lg disabled:opacity-50"
                                  onClick={() => {
                                    const isWeight = isWeightBasedUnit(item.saleUnit)
                                    const step = isWeight ? WEIGHT_STEP : 1
                                    updateQuantity(item.cartItemId, Math.round((item.quantity + step) * 100) / 100)
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-xl">
                                  {itemTotal.toFixed(2)} {formatCurrency(item.currency)}
                                  {item.saleUnit && item.saleUnit !== 'piece' && (
                                    <span className="text-sm font-medium text-slate-500"> / {getSaleUnitLabel(item.saleUnit, lang as 'en' | 'ar')}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="shrink-0 rounded-full text-slate-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div
                  className="border-t bg-white p-4 space-y-3 shrink-0"
                  style={{
                    backgroundColor: 'white',
                    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)'
                  }}
                >
                  {!isReady ? (
                    <>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">{t('Total', 'المجموع')}:</span>
                        <span className="font-black text-3xl">
                          {totalPrice.toFixed(2)} {formatCurrency(items[0]?.currency)}
                        </span>
                      </div>
                      <Button
                        onClick={handleReady}
                        className="w-full h-14 rounded-xl font-black text-lg bg-black hover:bg-slate-800"
                      >
                        {t('READY!', 'جاهز!')}
                      </Button>
                    </>
                  ) : (
                    <>
                      {(customerName || tableNumber || orderType) && (
                        <div className="bg-slate-50 rounded-xl p-3 mb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {orderType && (
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                                  {orderType === 'dine-in'
                                    ? t('🍽️ Dine-in', '🍽️ تناول الطعام هنا')
                                    : t('🚗 Delivery', '🚗 توصيل')
                                  }
                                </p>
                              )}
                              {customerName && (
                                <p className="text-sm text-slate-600">
                                  <span className="font-bold">{t('Name', 'الاسم')}:</span> {customerName}
                                </p>
                              )}
                              {orderType === 'dine-in' && tableNumber && (
                                <p className="text-sm text-slate-600 mt-1">
                                  <span className="font-bold">{t('Table', 'الطاولة')}:</span> {tableNumber}
                                </p>
                              )}
                              {orderType === 'delivery' && customerPhone && (
                                <p className="text-sm text-slate-600 mt-1">
                                  <span className="font-bold">{t('Phone', 'الهاتف')}:</span> {customerPhone}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleEditOrderInfo}
                              className="h-8 w-8 rounded-lg shrink-0"
                              title={t('Edit order info', 'تعديل معلومات الطلب')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Show subtotal, delivery fee, and shopper fee for delivery orders */}
                      {orderType === 'delivery' && (deliveryFee > 0 || isFreeDelivery || cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup) && (
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">{t('Subtotal', 'المجموع الفرعي')}:</span>
                            <span className="font-bold">
                              {totalPrice.toFixed(2)} {formatCurrency(items[0]?.currency)}
                            </span>
                          </div>
                          {(deliveryFee > 0 || isFreeDelivery) && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">{t('Delivery Fee', 'رسوم التوصيل')}:</span>
                              {isFreeDelivery ? (
                                <span className="font-bold text-emerald-600">{t('FREE', 'مجاناً')}</span>
                              ) : (
                                <span className="font-bold">
                                  {deliveryFee.toFixed(2)} {formatCurrency(items[0]?.currency)}
                                </span>
                              )}
                            </div>
                          )}
                          {isFreeDelivery && (
                            <p className="text-[11px] text-emerald-700">
                              {t('Business pays this delivery fee.', 'المتجر يدفع رسوم التوصيل هذه.')}
                            </p>
                          )}
                          {(cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup) && (
                            <div className="rounded-xl border border-amber-200/60 bg-amber-50/70 p-2.5 space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                                  <span aria-hidden>🛍️</span>
                                  {t('Save Time fee', 'رسوم توفير الوقت')}
                                </span>
                                <span className="font-bold shrink-0">
                                  {getShopperFeeByItemCount(totalItems) === 0
                                    ? t('FREE', 'مجاناً')
                                    : `${getShopperFeeByItemCount(totalItems).toFixed(2)} ${formatCurrency(items[0]?.currency)}`}
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                                {getShopperFeeExplanation(totalItems, lang, formatCurrency(items[0]?.currency)).body}
                              </p>
                              {getShopperFeeByItemCount(totalItems) === 0 && (
                                <p className="text-[10px] text-amber-800/80">
                                  {t('Up to 3 items = free. Your driver collects your order at the store at no extra cost.', 'حتى 3 أصناف = مجاناً. سائقنا يجمع طلبك من المتجر دون تكلفة إضافية.')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-lg border-t pt-2">
                        <span className="font-semibold">{t('Total', 'المجموع')}:</span>
                        <span className="font-black text-2xl">
                          {finalTotal.toFixed(2)} {formatCurrency(items[0]?.currency)}
                        </span>
                      </div>

                      {/* Main SEND Button */}
                      {isSharedCart && !isHost ? (
                        <Button
                          disabled
                          className="w-full h-16 rounded-xl font-black text-xl bg-slate-200 text-slate-500 shadow-none"
                        >
                          {t('Waiting for Host to send...', 'في انتظار المضيف لإرسال الطلب...')}
                        </Button>
                      ) : (
                        <Button
                          onClick={isSharedCart && isHost ? () => setShowHostConfirmDialog(true) : () => void handleSendToKitchen()}
                          disabled={isSendingOrder}
                          className="w-full h-16 rounded-xl font-black text-xl bg-green-600 hover:bg-green-700 shadow-xl shadow-green-600/20"
                        >
                          <Send className="w-6 h-6 mr-2" />
                          {isSendingOrder
                            ? t('Sending...', 'جارٍ الإرسال...')
                            : isSharedCart
                              ? t('Review & Send Order', 'مراجعة وإرسال الطلب')
                              : t('SEND ORDER', 'إرسال الطلب')}
                        </Button>
                      )}

                      {/* QR code temporarily disabled – only SEND ORDER sends to Order Management. To re-enable: show when orderType === 'dine-in'. */}
                      {false && orderType === 'dine-in' && (
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            onClick={handleQRCode}
                            variant="outline"
                            className="h-11 rounded-xl font-bold border-2 border-slate-300"
                          >
                            <QrCode className="w-4 h-4 mr-2" />
                            {t('QR', 'رمز')}
                          </Button>
                        </div>
                      )}

                      <Button
                        onClick={handleNewOrder}
                        variant="outline"
                        className="w-full h-11 rounded-xl font-bold border-2 border-slate-300 hover:bg-slate-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('New Order', 'طلب جديد')}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQRCode(false)}
              className="absolute top-4 right-4 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black mb-2">{t('Your Order QR Code', 'رمز الطلب')}</h3>
              <p className="text-slate-500 text-sm mb-1">
                {t('Show this QR code to the waiter', 'اعرض هذا الرمز للنادل')}
              </p>
              <p className="text-xs text-slate-400">
                {t('They can scan it to view and print your order', 'يمكنهم مسحه لعرض وطباعة طلبك')}
              </p>
            </div>
            <div className="flex justify-center mb-6 bg-slate-50 p-6 rounded-2xl">
              <QRCodeSVG
                value={orderData}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  window.open(orderData, '_blank')
                }}
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold"
              >
                {t('Open', 'فتح')}
              </Button>
              <Button
                onClick={() => setShowQRCode(false)}
                className="flex-1 h-12 rounded-xl font-bold"
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
        tenantSlug={tenantSlug ?? cartTenant?.slug ?? undefined}
        supportsDineIn={true}
        deliveryLat={deliveryLat}
        deliveryLng={deliveryLng}
        setDeliveryLocation={setDeliveryLocation}
        clearDeliveryLocation={clearDeliveryLocation}
      />
      <Dialog open={showHostConfirmDialog} onOpenChange={setShowHostConfirmDialog}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {t('Ready to send?', 'هل أنتم مستعدون للإرسال؟')}
            </DialogTitle>
            <DialogDescription className="text-center mt-2">
              {t('Are you sure everyone at the table is finished ordering?', 'هل أنت متأكد أن جميع من على الطاولة قد انتهوا من الطلب؟')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => {
                setShowHostConfirmDialog(false)
                void handleSendToKitchen()
              }}
              className="w-full h-14 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              {t('Yes, send order', 'نعم، أرسل الطلب')}
            </Button>
            <Button
              onClick={() => setShowHostConfirmDialog(false)}
              variant="outline"
              className="w-full h-14 rounded-2xl font-bold"
            >
              {t('Wait, not yet', 'انتظر قليلاً')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  )
}
