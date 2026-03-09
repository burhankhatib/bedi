'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Product, ProductAddOn } from '@/app/types/menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import Link from 'next/link'
import { Store, ArrowRight, RotateCcw } from 'lucide-react'
import { getVariantOptionModifier } from '@/lib/cart-price'

export interface CartTenant {
  slug: string
  name: string
  logoRef?: string
  openingHours?: any[] | null
  customDateHours?: any[] | null
  businessCountry?: string
  deliveryPricingMode?: 'areas' | 'distance'
  deliveryFeeMin?: number
  deliveryFeeMax?: number
}

/** Order-type flags for the current cart tenant (from menu page). Used to show/hide Dine-in, Receive in Person, Delivery in the order dialog. */
export interface OrderTypeOptions {
  supportsDineIn: boolean
  supportsReceiveInPerson: boolean
  hasDelivery: boolean
}

export interface CartItem extends Product {
  cartItemId: string // Unique ID for product + add-ons + variants
  quantity: number
  notes?: string
  selectedAddOns?: string[]
  /** Option index per variant group; undefined = optional group not selected (e.g. [0, undefined, 1]) */
  selectedVariants?: (number | undefined)[]
}

interface ToastMessage {
  id: string
  message: string
  productName: string
}

export type OrderType = 'receive-in-person' | 'dine-in' | 'delivery'

interface CartContextType {
  items: CartItem[]
  /** Pass tenantContext when adding from a menu page; enforces single-business cart. */
  addToCart: (product: Product, selectedAddOns?: string[], selectedVariants?: (number | undefined)[], tenantContext?: CartTenant, orderTypeOptions?: OrderTypeOptions) => void
  removeFromCart: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  updateNotes: (cartItemId: string, notes: string) => void
  updateAddOns: (cartItemId: string, selectedAddOns: string[]) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  customerName: string
  setCustomerName: (name: string) => void
  tableNumber: string
  setTableNumber: (table: string) => void
  isReady: boolean
  setIsReady: (ready: boolean) => void
  orderType: OrderType | null
  setOrderType: (type: OrderType | null) => void
  // Delivery fields
  customerPhone: string
  setCustomerPhone: (phone: string) => void
  deliveryAreaId: string
  setDeliveryAreaId: (areaId: string) => void
  deliveryAddress: string
  setDeliveryAddress: (address: string) => void
  deliveryLat: number | null
  deliveryLng: number | null
  setDeliveryLocation: (lat: number, lng: number) => void
  clearDeliveryLocation: () => void
  deliveryFee: number
  setDeliveryFee: (fee: number) => void
  scheduledFor?: string
  setScheduledFor: (dateStr?: string) => void
  toast: ToastMessage | null
  showToast: (message: string, productName: string) => void
  hideToast: () => void
  /** When on /t/[slug], set so order is sent to the correct tenant */
  tenantSlug: string | null
  setTenantSlug: (slug: string | null) => void
  /** Business whose items are in the cart (for display and link back). */
  cartTenant: CartTenant | null
  /** Pending item + tenants when adding from different business; modal prompts user. */
  conflictState: {
    cartTenant: CartTenant
    newTenant: CartTenant
    pending: { product: Product; selectedAddOns?: string[]; selectedVariants?: (number | undefined)[] }
  } | null
  resolveConflictReplace: () => void
  resolveConflictGoBack: () => void
  resolveConflictCancel: () => void
  /** Set when adding from a tenant menu; used by order dialog to show/hide Dine-in, Receive in Person, Delivery. */
  orderTypeOptions: OrderTypeOptions | null
  /** When customer landed via table QR (?table=N), lock Dine-in and table number. */
  lockedTableNumber: string | null
  setLockedTableNumber: (table: string | null) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_TENANT_KEY = 'cartTenant'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [items, setItems] = useState<CartItem[]>([])
  const [cartTenant, setCartTenant] = useState<CartTenant | null>(null)
  const [orderTypeOptions, setOrderTypeOptions] = useState<OrderTypeOptions | null>(null)
  const [lockedTableNumber, setLockedTableNumber] = useState<string | null>(null)
  const [conflictState, setConflictState] = useState<CartContextType['conflictState']>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [customerName, setCustomerName] = useState<string>('')
  const [tableNumber, setTableNumber] = useState<string>('')
  const [isReady, setIsReady] = useState<boolean>(false)
  const [orderType, setOrderType] = useState<OrderType | null>(null)
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [deliveryAreaId, setDeliveryAreaId] = useState<string>('')
  const [deliveryAddress, setDeliveryAddress] = useState<string>('')
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [deliveryFee, setDeliveryFee] = useState<number>(0)
  const [scheduledFor, setScheduledFor] = useState<string | undefined>(undefined)
  const setDeliveryLocation = useCallback((lat: number, lng: number) => {
    setDeliveryLat(lat)
    setDeliveryLng(lng)
  }, [])
  const clearDeliveryLocation = useCallback(() => {
    setDeliveryLat(null)
    setDeliveryLng(null)
  }, [])
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)

  // Load cart + cartTenant from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart')
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart)
        setItems(Array.isArray(parsed) ? parsed : parsed?.items ?? [])
        if (parsed?.cartTenant?.slug) setCartTenant(parsed.cartTenant)
      } catch (error) {
        console.error('Failed to load cart from localStorage:', error)
      }
    }
    const savedTenant = localStorage.getItem(CART_TENANT_KEY)
    if (savedTenant) {
      try {
        const parsed = JSON.parse(savedTenant)
        if (parsed?.slug) setCartTenant(parsed)
      } catch {
        // ignore
      }
    }
    const savedCustomerInfo = localStorage.getItem('customerInfo')
    if (savedCustomerInfo) {
      try {
        const info = JSON.parse(savedCustomerInfo)
        setCustomerName(info.name || '')
        setTableNumber(info.tableNumber || '')
        setIsReady(info.isReady || false)
        setOrderType(info.orderType || null)
        setCustomerPhone(info.customerPhone || '')
        setDeliveryAreaId(info.deliveryAreaId || '')
        setDeliveryAddress(info.deliveryAddress || '')
        setDeliveryLat(typeof info.deliveryLat === 'number' ? info.deliveryLat : null)
        setDeliveryLng(typeof info.deliveryLng === 'number' ? info.deliveryLng : null)
        setDeliveryFee(info.deliveryFee || 0)
        setScheduledFor(info.scheduledFor)
      } catch (error) {
        console.error('Failed to load customer info from localStorage:', error)
      }
    }
  }, [])

  // Save cart to localStorage (array for backwards compat)
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items))
  }, [items])

  // Save cartTenant to localStorage whenever it changes
  useEffect(() => {
    if (cartTenant) {
      localStorage.setItem(CART_TENANT_KEY, JSON.stringify(cartTenant))
    } else {
      localStorage.removeItem(CART_TENANT_KEY)
    }
  }, [cartTenant])

  // Save customer info to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('customerInfo', JSON.stringify({
      name: customerName,
      tableNumber: tableNumber,
      isReady: isReady,
      orderType: orderType,
      customerPhone: customerPhone,
      deliveryAreaId: deliveryAreaId,
      deliveryAddress: deliveryAddress,
      deliveryLat: deliveryLat,
      deliveryLng: deliveryLng,
      deliveryFee: deliveryFee,
      scheduledFor: scheduledFor,
    }))
  }, [customerName, tableNumber, isReady, orderType, customerPhone, deliveryAreaId, deliveryAddress, deliveryLat, deliveryLng, deliveryFee, scheduledFor])

  const doAddItem = useCallback((
    product: Product,
    selectedAddOns: string[],
    selectedVariants: (number | undefined)[],
    tenant: CartTenant | null
  ) => {
    const addonsKey = (selectedAddOns || []).sort().join('-')
    const v = selectedVariants ?? []
    const variantsKey = v.length > 0 ? `v${v.map((x) => (x === undefined ? 'x' : x)).join('-')}` : ''
    const parts = [product._id]
    if (addonsKey) parts.push(addonsKey)
    if (variantsKey) parts.push(variantsKey)
    const cartItemId = parts.join('-')

    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.cartItemId === cartItemId)
      if (existingItem) {
        return prevItems.map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prevItems, {
        ...product,
        cartItemId,
        quantity: 1,
        notes: '',
        selectedAddOns: selectedAddOns || [],
        selectedVariants: selectedVariants ?? [],
      }]
    })
    if (tenant) setCartTenant(tenant)
    showToast(t('Item added to cart!', 'تمت إضافة الصنف للسلة'), product.title_en || product.title_ar || 'Item')
  }, [t])

  const addToCart = (product: Product, selectedAddOns?: string[], selectedVariants?: (number | undefined)[], tenantContext?: CartTenant, orderTypeOptionsParam?: OrderTypeOptions) => {
    const addons = selectedAddOns || []
    const variants = selectedVariants ?? []

    // Single-business rule: if cart has items from a different business, show conflict modal
    if (items.length > 0 && tenantContext && cartTenant) {
      if (cartTenant.slug === tenantContext.slug) {
        doAddItem(product, addons, variants, null) // tenant already set
        if (orderTypeOptionsParam) setOrderTypeOptions(orderTypeOptionsParam)
        return
      }
      setConflictState({
        cartTenant,
        newTenant: tenantContext,
        pending: { product, selectedAddOns: addons, selectedVariants: variants },
      })
      return
    }

    const tenant = tenantContext ?? cartTenant
    doAddItem(product, addons, variants, tenant)
    if (tenantContext && orderTypeOptionsParam) setOrderTypeOptions(orderTypeOptionsParam)
  }

  const resolveConflictReplace = useCallback(() => {
    if (!conflictState) return
    const { newTenant, pending } = conflictState
    setItems([])
    setCartTenant(newTenant)
    setOrderTypeOptions(null)
    setLockedTableNumber(null)
    setTenantSlug(newTenant.slug)
    setIsReady(false)
    setCustomerName('')
    setTableNumber('')
    setOrderType(null)
    setCustomerPhone('')
    setDeliveryAreaId('')
    setDeliveryAddress('')
    setDeliveryFee(0)
    doAddItem(pending.product, pending.selectedAddOns || [], pending.selectedVariants ?? [], newTenant)
    setConflictState(null)
    setIsOpen(true)
  }, [conflictState, setTenantSlug, doAddItem])

  const resolveConflictGoBack = useCallback(() => {
    if (!conflictState) return
    router.push(`/t/${conflictState.cartTenant.slug}`)
    setConflictState(null)
  }, [conflictState, router])

  const resolveConflictCancel = useCallback(() => {
    setConflictState(null)
  }, [])

  const showToast = (message: string, productName: string) => {
    const id = Date.now().toString()
    setToast({ id, message, productName })
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  const hideToast = () => {
    setToast(null)
  }

  const removeFromCart = (cartItemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId))
  }

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId)
      return
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    )
  }

  const updateNotes = (cartItemId: string, notes: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, notes } : item
      )
    )
  }

  const updateAddOns = (cartItemId: string, selectedAddOns: string[]) => {
    const productId = cartItemId.split('-')[0]
    const addonsKey = (selectedAddOns || []).sort().join('-')
    const newCartItemId = addonsKey ? `${productId}-${addonsKey}` : productId

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, cartItemId: newCartItemId, selectedAddOns } : item
      )
    )
  }

  const clearCart = useCallback(() => {
    setItems([])
    setCartTenant(null)
    setIsReady(false)
    setCustomerName('')
    setTableNumber('')
    setOrderType(null)
    setCustomerPhone('')
    setDeliveryAreaId('')
    setDeliveryAddress('')
    setDeliveryFee(0)
  }, [])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  const totalPrice = items.reduce((sum, item) => {
    const hasSpecialPrice =
      item.specialPrice &&
      (!item.specialPriceExpires ||
        new Date(item.specialPriceExpires) > new Date())
    const basePrice = hasSpecialPrice ? item.specialPrice! : item.price

    const addOnPrice = (item.selectedAddOns || []).reduce((addOnSum, addOnKey) => {
      const addOn = item.addOns?.find(a =>
        a._key === addOnKey ||
        `${a.name_en}-${a.price}` === addOnKey
      )
      return addOnSum + (addOn?.price || 0)
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

    return sum + (basePrice + addOnPrice + variantPrice) * item.quantity
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateNotes,
        updateAddOns,
        clearCart,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
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
        toast,
        showToast,
        hideToast,
        tenantSlug,
        setTenantSlug,
        cartTenant,
        conflictState,
        resolveConflictReplace,
        resolveConflictGoBack,
        resolveConflictCancel,
        orderTypeOptions,
        lockedTableNumber,
        setLockedTableNumber,
      }}
    >
      {children}
      {conflictState && (
        <CartConflictModal
          conflictState={conflictState}
          onReplace={resolveConflictReplace}
          onGoBack={resolveConflictGoBack}
          onCancel={resolveConflictCancel}
        />
      )}
    </CartContext.Provider>
  )
}

function CartConflictModal({
  conflictState,
  onReplace,
  onGoBack,
  onCancel,
}: {
  conflictState: NonNullable<CartContextType['conflictState']>
  onReplace: () => void
  onGoBack: () => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const { cartTenant, newTenant } = conflictState

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-md"
        overlayClassName="z-[400]"
        contentClassName="z-[400]"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            {t('Different restaurant', 'مطعم مختلف')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Your cart has items from another restaurant. You can only order from one restaurant at a time.',
              'سلتك تحتوي على أصناف من مطعم آخر. يمكنك الطلب من مطعم واحد فقط في كل مرة.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600 mb-2">
              {t('Cart from', 'السلة من')}: <span className="font-bold text-slate-900">{cartTenant.name}</span>
            </p>
            <p className="text-sm font-medium text-slate-600">
              {t('Adding from', 'إضافة من')}: <span className="font-bold text-slate-900">{newTenant.name}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={onGoBack}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              <Store className="size-5" />
              {t('Go back to', 'العودة إلى')} {cartTenant.name}
            </Button>
            <Button
              onClick={onReplace}
              className="w-full gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
              size="lg"
            >
              <RotateCcw className="size-5" />
              {t('Clear cart & order from', 'إفراغ السلة والطلب من')} {newTenant.name}
            </Button>
            <Button
              onClick={onCancel}
              variant="ghost"
              className="w-full"
              size="sm"
            >
              {t('Cancel', 'إلغاء')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
