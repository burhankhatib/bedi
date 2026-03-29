'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { useLanguage } from '@/components/LanguageContext'
import { useOrderAuth } from '@/lib/useOrderAuth'
import { OrderAuthGate } from '@/components/OrderAuthGate'
import { useToast } from '@/components/ui/ToastProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, ShoppingCart, QrCode, Edit2, RotateCcw, Send, Store, ArrowRight, Trash2, LogOut } from 'lucide-react'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { useState, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { formatCurrency } from '@/lib/currency'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { getShopperFeeByItemCount, getShopperFeeExplanation } from '@/lib/shopper-fee'
import {
  getVariantBreakdownForLang,
  getVariantBreakdownAr,
  formatAddOnsListForLang,
  formatAddOnsListAr,
  getCartLineUnitPrice,
  getCartLineTotal,
} from '@/lib/cart-line-calculations'
import { UnifiedOrderDialog } from './UnifiedOrderDialog'
import { CartSliderLineItem } from './CartSliderLineItem'

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
    orderTypeOptions,
    lockedTableNumber,
    deviceId,
    hostId,
    isGroupLeader,
    groupSessionMembers,
    groupMemberName,
    leaveTable,
    clearTableCart,
    resetCartAndDisconnectCollaboration,
  } = useCart()
  const { t, lang } = useLanguage()

  const isSharedCart = orderType === 'dine-in' && !!tableNumber && !!cartTenant?.slug && !!deviceId
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

  const isRTL = lang === 'ar'
  const cartCurrencyCode = items[0]?.currency ?? 'ILS'

  /** Memoized delivery + shopper totals when checkout UI is active — avoids repeated getShopperFee* on every render. */
  const readyCheckoutTotals = useMemo(() => {
    if (!isReady || items.length === 0) return null
    const isDelivery = orderType === 'delivery'
    const hasShopper =
      !!cartTenant?.requiresPersonalShopper || !!cartTenant?.supportsDriverPickup
    const freeDel =
      deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true
    const shopperFee =
      isDelivery && hasShopper ? getShopperFeeByItemCount(totalItems) : 0
    const shopperExplanation = getShopperFeeExplanation(
      totalItems,
      lang,
      formatCurrency(cartCurrencyCode)
    )
    const grandTotal =
      isDelivery
        ? totalPrice + (freeDel ? 0 : deliveryFee) + (hasShopper ? shopperFee : 0)
        : totalPrice
    return {
      isDelivery,
      hasShopper,
      freeDel,
      shopperFee,
      shopperExplanation,
      grandTotal,
    }
  }, [
    isReady,
    items.length,
    orderType,
    cartTenant?.requiresPersonalShopper,
    cartTenant?.supportsDriverPickup,
    cartTenant?.freeDeliveryEnabled,
    deliveryFeePaidByBusiness,
    totalItems,
    totalPrice,
    deliveryFee,
    lang,
    cartCurrencyCode,
  ])

  const getOrderData = () => {
    const locale = lang === 'ar' ? 'ar' : 'en'
    return items.map((item) => {
      const { variantParts } = getVariantBreakdownForLang(item, locale)
      const variantText = variantParts.join(', ')
      const itemPrice = getCartLineUnitPrice(item)
      const itemTotal = getCartLineTotal(item)
      const addOnsList = formatAddOnsListForLang(item, locale)
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
      const { variantPartsAr } = getVariantBreakdownAr(item)
      const itemTotal = getCartLineTotal(item)
      const title = item.title_ar || item.title_en

      const addOnsText = formatAddOnsListAr(item)
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
    const isFreeDelivery =
      orderType === 'delivery' &&
      (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
    const shopperFee =
      orderType === 'delivery' &&
      (cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup)
        ? getShopperFeeByItemCount(totalItems)
        : 0
    const finalTotal =
      orderType === 'delivery'
        ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) + shopperFee
        : totalPrice
    const total = `\n${'='.repeat(20)}\nالمجموع: ${finalTotal.toFixed(2)} ${formatCurrency(items[0]?.currency)}`

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

  const handleSendOrder = async () => {
    setIsSendingOrder(true)

    try {
      const locale = lang === 'ar' ? 'ar' : 'en'
      const orderItems = items.map((item) => {
        const { variantParts } = getVariantBreakdownForLang(item, locale)
        const variantStr = variantParts.join(', ')
        const addOnsList = formatAddOnsListForLang(item, locale)
        const productName = [lang === 'ar' ? item.title_ar : item.title_en, variantStr].filter(Boolean).join(' · ')

        const itemPrice = getCartLineUnitPrice(item)
        const itemTotal = getCartLineTotal(item)

        return {
          productId: item._id,
          productName,
          quantity: item.quantity,
          price: itemPrice,
          total: itemTotal,
          notes: item.notes || '',
          addOns: addOnsList,
          saleUnit: item.saleUnit || undefined,
        }
      })

      const isFreeDelivery =
        orderType === 'delivery' &&
        (deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled === true)
      const shopperFee = orderType === 'delivery' && (cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup)
        ? getShopperFeeByItemCount(totalItems)
        : 0
      const finalTotal = orderType === 'delivery'
        ? totalPrice + (isFreeDelivery ? 0 : deliveryFee) + shopperFee
        : totalPrice

      const orderPayload: Record<string, unknown> = {
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
        `Order #${result.orderNumber} sent successfully!`,
        `تم إرسال الطلب #${result.orderNumber} بنجاح!`,
        'success'
      )

      clearCart()
      setIsOpen(false)

      const slugForTrack =
        (typeof tenantSlug === 'string' && tenantSlug.trim()) ||
        (cartTenant?.slug && String(cartTenant.slug).trim()) ||
        (typeof result.siteSlug === 'string' && result.siteSlug.trim()) ||
        ''
      // Defer soft navigation until after React commits cart closed — otherwise router.replace
      // can run while cartOpen is still true and the track page stays behind pointer-events-none / Sheet overlay.
      const go = () => {
        if (result.trackingToken && slugForTrack) {
          router.replace(`/t/${slugForTrack}/track/${result.trackingToken}`)
        } else if (result.orderId && slugForTrack) {
          router.replace(`/t/${slugForTrack}/order/${result.orderId}`)
        }
      }
      setTimeout(go, 0)
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
          portalClassName="z-[1000]"
          overlayClassName="z-[1000] bg-black/90"
          contentClassName="z-[1001]"
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
                      placeholder="blur"
                      blurDataURL={SHIMMER_PLACEHOLDER}
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
                {items.map((item) => (
                  <CartSliderLineItem
                    key={item.cartItemId}
                    item={item}
                    lang={lang}
                    t={t}
                    onRemove={removeFromCart}
                    onUpdateQuantity={updateQuantity}
                    onUpdateNotes={updateNotes}
                    isSharedCart={isSharedCart}
                    canEdit={!isSharedCart || item.ownerId === deviceId || isGroupLeader}
                  />
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div
              className="border-t bg-white p-6 space-y-4 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }}
            >
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
                  {orderType === 'delivery' && (deliveryFee > 0 || deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled || cartTenant?.requiresPersonalShopper || cartTenant?.supportsDriverPickup) && (
                    <div className="space-y-2 text-sm px-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{t('Subtotal', 'المجموع الفرعي')}</span>
                        <span className="font-bold">
                          {totalPrice.toFixed(2)} {formatCurrency(items[0]?.currency)}
                        </span>
                      </div>
                      {(deliveryFee > 0 || deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled) && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">{t('Delivery Fee', 'رسوم التوصيل')}</span>
                          {(deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled) ? (
                            <span className="font-bold text-emerald-600">{t('FREE', 'مجاناً')}</span>
                          ) : (
                            <span className="font-bold">
                              {deliveryFee.toFixed(2)} {formatCurrency(items[0]?.currency)}
                            </span>
                          )}
                        </div>
                      )}
                      {(deliveryFeePaidByBusiness || cartTenant?.freeDeliveryEnabled) && (
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
                              {readyCheckoutTotals && readyCheckoutTotals.shopperFee === 0
                                ? t('FREE', 'مجاناً')
                                : `${(readyCheckoutTotals?.shopperFee ?? 0).toFixed(2)} ${formatCurrency(items[0]?.currency)}`}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900/90 leading-relaxed">
                            {readyCheckoutTotals?.shopperExplanation.body}
                          </p>
                          {readyCheckoutTotals && readyCheckoutTotals.shopperFee === 0 && (
                            <p className="text-[10px] text-amber-800/80">
                              {t('Up to 3 items = free. Your driver collects your order at the store at no extra cost.', 'حتى 3 أصناف = مجاناً. سائقنا يجمع طلبك من المتجر دون تكلفة إضافية.')}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="border-t pt-2"></div>
                    </div>
                  )}

                  <div className="flex justify-between items-center px-1">
                    <span className="font-black text-slate-400 text-sm uppercase tracking-widest">{t('Total', 'المجموع')}</span>
                    <span className="font-black text-2xl">
                      {(readyCheckoutTotals?.grandTotal ?? totalPrice).toFixed(2)}{' '}
                      {formatCurrency(items[0]?.currency)}
                    </span>
                  </div>

                  {/* Group session member badges */}
                  {isSharedCart && groupSessionMembers.length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                        {t('At the table', 'عند الطاولة')} ({groupSessionMembers.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupSessionMembers.map((m) => (
                          <span
                            key={m.deviceId}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              m.deviceId === deviceId
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.role === 'leader' && <span className="text-amber-500">👑</span>}
                            {m.displayName || groupMemberName}
                            {m.deviceId === deviceId && ` (${t('You', 'أنت')})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main SEND Button — leader only for shared carts */}
                  {isSharedCart && !isGroupLeader ? (
                    <div className="w-full h-16 rounded-2xl bg-slate-100 flex items-center justify-center gap-2 text-slate-500 font-semibold">
                      <span className="animate-pulse">⏳</span>
                      {t('Waiting for group leader to place order…', 'بانتظار قائد المجموعة لإرسال الطلب…')}
                    </div>
                  ) : (
                    <Button
                      onClick={isSharedCart ? () => setShowHostConfirmDialog(true) : handleSendOrder}
                      disabled={isSendingOrder}
                      className="w-full h-16 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-[0.98] transition-all"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      {isSendingOrder
                        ? t('Sending...', 'جارٍ الإرسال...')
                        : isSharedCart
                          ? t('Send Group Order', 'إرسال طلب المجموعة')
                          : t('SEND ORDER', 'إرسال الطلب')
                      }
                    </Button>
                  )}

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

                  {isSharedCart ? (
                    <div className="space-y-2 mt-2">
                      <div className={`grid gap-2 ${isGroupLeader ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {isGroupLeader && (
                          <Button
                            onClick={() => {
                              if (confirm(t('Clear all items from this table?', 'مسح كل الأصناف من هذه الطاولة؟'))) {
                                clearTableCart?.()
                              }
                            }}
                            variant="outline"
                            className="h-11 rounded-xl font-bold border-2 border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('Clear Table', 'مسح الطاولة')}
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            if (confirm(t('Leave this table and remove your items?', 'مغادرة هذه الطاولة وإزالة أصنافك؟'))) {
                              leaveTable?.()
                            }
                          }}
                          variant="outline"
                          className="h-11 rounded-xl font-bold border-2 border-slate-300 hover:bg-slate-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          {t('Leave Table', 'مغادرة')}
                        </Button>
                      </div>
                      <Button
                        onClick={() => {
                          if (
                            confirm(
                              t(
                                'Clear your cart, remove your items from this table, and disconnect from shared ordering. Other guests keep their items.',
                                'سيتم مسح سلتك وإزالة أصنافك من الطاولة ومغادرة الطلب المشترك. باقي الضيوف يبقون كما هم.'
                              )
                            )
                          ) {
                            resetCartAndDisconnectCollaboration()
                          }
                        }}
                        variant="outline"
                        className="w-full h-11 rounded-xl font-bold border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('Reset cart & disconnect', 'إعادة ضبط السلة ومغادرة الطلب المشترك')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      <Button
                        onClick={handleNewOrder}
                        variant="ghost"
                        className="w-full h-12 rounded-xl font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('New Order', 'طلب جديد')}
                      </Button>
                      {totalItems > 0 && (
                        <Button
                          onClick={() => {
                            if (
                              confirm(
                                t(
                                  'Clear your cart and all checkout details (delivery address, schedule, etc.)?',
                                  'مسح السلة وجميع بيانات الدفع (العنوان، الموعد، وغيرها)؟'
                                )
                              )
                            ) {
                              resetCartAndDisconnectCollaboration()
                            }
                          }}
                          variant="outline"
                          className="w-full h-11 rounded-xl font-bold border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          {t('Clear cart & checkout details', 'مسح السلة وتفاصيل الطلب')}
                        </Button>
                      )}
                    </div>
                  )}
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
        tenantSlug={tenantSlug ?? cartTenant?.slug ?? undefined}
        supportsDineIn={orderTypeOptions?.supportsDineIn ?? supportsDineIn}
        supportsReceiveInPerson={orderTypeOptions?.supportsReceiveInPerson ?? supportsReceiveInPerson}
        hasDelivery={orderTypeOptions?.hasDelivery}
        lockedTableNumber={lockedTableNumber}
        deliveryLat={deliveryLat}
        deliveryLng={deliveryLng}
        setDeliveryLocation={setDeliveryLocation}
        clearDeliveryLocation={clearDeliveryLocation}
      />
      <Dialog open={showHostConfirmDialog} onOpenChange={setShowHostConfirmDialog}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {t('Send group order?', 'إرسال طلب المجموعة؟')}
            </DialogTitle>
            <DialogDescription className="text-center mt-2">
              {t(
                'As the group leader, you\'re about to place the order for everyone at the table. Make sure everyone is done adding items.',
                'بصفتك قائد المجموعة، ستقوم بإرسال الطلب لجميع من على الطاولة. تأكد من أن الجميع انتهى من إضافة طلباته.'
              )}
            </DialogDescription>
          </DialogHeader>
          {groupSessionMembers.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3 my-2">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                {t('Ordering for', 'الطلب لـ')} {groupSessionMembers.length} {t('people', 'أشخاص')}:
              </p>
              <div className="flex flex-wrap gap-1">
                {groupSessionMembers.map((m) => (
                  <span key={m.deviceId} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {m.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 mt-2">
            <Button
              onClick={() => {
                setShowHostConfirmDialog(false)
                handleSendOrder()
              }}
              className="w-full h-14 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              {t('Yes, send for everyone', 'نعم، أرسل للجميع')}
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
