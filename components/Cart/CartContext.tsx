'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { pusherClient } from '@/lib/pusher-client'
import { Product, DayHours, CustomDateHours } from '@/app/types/menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { Store, RotateCcw } from 'lucide-react'
import { getVariantOptionModifier } from '@/lib/cart-price'

export interface CartTenant {
  slug: string
  name: string
  logoRef?: string
  openingHours?: DayHours[] | null
  customDateHours?: CustomDateHours[] | null
  businessCountry?: string
  /** When true, business is manually closed. With opening hours, used to compute schedule-only checkout. */
  isManuallyClosed?: boolean
  /** ISO date when manual closure ends. Used to validate scheduledFor. */
  deactivateUntil?: string | null
  deliveryPricingMode?: 'areas' | 'distance'
  deliveryFeeMin?: number
  deliveryFeeMax?: number
  freeDeliveryEnabled?: boolean
  requiresPersonalShopper?: boolean
  supportsDriverPickup?: boolean
  shopperFee?: number
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
  ownerId?: string
  ownerName?: string
}

interface ToastMessage {
  id: string
  message: string
  productName: string
}

export type OrderType = 'receive-in-person' | 'dine-in' | 'delivery'

interface CartContextType {
  deviceId: string | null
  hostId: string | null
  items: CartItem[]
  /** Pass tenantContext when adding from a menu page; enforces single-business cart. */
  addToCart: (product: Product, selectedAddOns?: string[], selectedVariants?: (number | undefined)[], tenantContext?: CartTenant, orderTypeOptions?: OrderTypeOptions, quantity?: number) => void
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
  deliveryAccuracyMeters?: number | null
  deliveryLocationSource?: 'gps_high' | 'gps_low' | 'manual_picker' | 'maps_link' | 'cache'
  setDeliveryLocation: (lat: number, lng: number, accuracyMeters?: number | null, source?: 'gps_high' | 'gps_low' | 'manual_picker' | 'maps_link' | 'cache') => void
  clearDeliveryLocation: () => void
  deliveryFee: number
  setDeliveryFee: (fee: number) => void
  /** True when this delivery fee is paid by the business (customer sees FREE). */
  deliveryFeePaidByBusiness: boolean
  setDeliveryFeePaidByBusiness: (value: boolean) => void
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
    pending: { product: Product; selectedAddOns?: string[]; selectedVariants?: (number | undefined)[]; quantity?: number }
  } | null
  resolveConflictReplace: () => void
  resolveConflictGoBack: () => void
  resolveConflictCancel: () => void
  /** Set when adding from a tenant menu; used by order dialog to show/hide Dine-in, Receive in Person, Delivery. */
  orderTypeOptions: OrderTypeOptions | null
  /** When customer landed via table QR (?table=N), lock Dine-in and table number. */
  lockedTableNumber: string | null
  setLockedTableNumber: (table: string | null) => void
  /** Joins a table session explicitly, establishing cartTenant and table session states */
  joinTableSession: (tenant: CartTenant, tableId: string, options?: OrderTypeOptions) => void
  /** Disconnects from the current table session and removes owned items from the shared cart */
  leaveTable: () => void
  /** Clears all items from the shared table cart (for all users) */
  clearTableCart: () => void
  /**
   * Removes this device from the shared table cart (`leave_table`), clears all local cart/checkout state,
   * and drops table locks — without broadcasting `clear_cart` (other guests keep their items).
   */
  resetCartAndDisconnectCollaboration: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_TENANT_KEY = 'cartTenant'
const STORAGE_DEBOUNCE_MS = 250

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [items, setItems] = useState<CartItem[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
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
  const [deliveryAccuracyMeters, setDeliveryAccuracyMeters] = useState<number | null>(null)
  const [deliveryLocationSource, setDeliveryLocationSource] = useState<CartContextType['deliveryLocationSource']>()
  const [deliveryFee, setDeliveryFee] = useState<number>(0)
  const [deliveryFeePaidByBusiness, setDeliveryFeePaidByBusiness] = useState<boolean>(false)
  const [scheduledFor, setScheduledFor] = useState<string | undefined>(undefined)
  const setDeliveryLocation = useCallback((lat: number, lng: number, accuracyMeters?: number | null, source?: CartContextType['deliveryLocationSource']) => {
    setDeliveryLat(lat)
    setDeliveryLng(lng)
    setDeliveryAccuracyMeters(accuracyMeters ?? null)
    if (source) setDeliveryLocationSource(source)
  }, [])
  const clearDeliveryLocation = useCallback(() => {
    setDeliveryLat(null)
    setDeliveryLng(null)
    setDeliveryAccuracyMeters(null)
    setDeliveryLocationSource(undefined)
  }, [])
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const persistTimersRef = useRef<{
    cart?: ReturnType<typeof setTimeout>
    tenant?: ReturnType<typeof setTimeout>
    orderTypeOptions?: ReturnType<typeof setTimeout>
    customerInfo?: ReturnType<typeof setTimeout>
  }>({})

  const showToast = useCallback((message: string, productName: string) => {
    const id = Date.now().toString()
    setToast({ id, message, productName })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  // Load cart + cartTenant from localStorage on mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client hydration from localStorage */
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
    const savedOrderTypeOptions = localStorage.getItem('orderTypeOptions')
    if (savedOrderTypeOptions) {
      try {
        setOrderTypeOptions(JSON.parse(savedOrderTypeOptions))
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
        setDeliveryAccuracyMeters(typeof info.deliveryAccuracyMeters === 'number' ? info.deliveryAccuracyMeters : null)
        setDeliveryLocationSource(info.deliveryLocationSource || 'cache')
        setDeliveryFee(info.deliveryFee || 0)
        setDeliveryFeePaidByBusiness(info.deliveryFeePaidByBusiness === true)
        setScheduledFor(info.scheduledFor)
      } catch (error) {
        console.error('Failed to load customer info from localStorage:', error)
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Save cart to localStorage (array for backwards compat)
  useEffect(() => {
    if (persistTimersRef.current.cart) clearTimeout(persistTimersRef.current.cart)
    persistTimersRef.current.cart = setTimeout(() => {
      localStorage.setItem('cart', JSON.stringify(items))
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (persistTimersRef.current.cart) clearTimeout(persistTimersRef.current.cart)
    }
  }, [items])

  // Save cartTenant to localStorage whenever it changes
  useEffect(() => {
    if (persistTimersRef.current.tenant) clearTimeout(persistTimersRef.current.tenant)
    persistTimersRef.current.tenant = setTimeout(() => {
      if (cartTenant) {
        localStorage.setItem(CART_TENANT_KEY, JSON.stringify(cartTenant))
      } else {
        localStorage.removeItem(CART_TENANT_KEY)
      }
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (persistTimersRef.current.tenant) clearTimeout(persistTimersRef.current.tenant)
    }
  }, [cartTenant])

  // Save orderTypeOptions to localStorage whenever it changes
  useEffect(() => {
    if (persistTimersRef.current.orderTypeOptions) clearTimeout(persistTimersRef.current.orderTypeOptions)
    persistTimersRef.current.orderTypeOptions = setTimeout(() => {
      if (orderTypeOptions) {
        localStorage.setItem('orderTypeOptions', JSON.stringify(orderTypeOptions))
      } else {
        localStorage.removeItem('orderTypeOptions')
      }
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (persistTimersRef.current.orderTypeOptions) clearTimeout(persistTimersRef.current.orderTypeOptions)
    }
  }, [orderTypeOptions])

  // Save customer info to localStorage whenever it changes
  useEffect(() => {
    if (persistTimersRef.current.customerInfo) clearTimeout(persistTimersRef.current.customerInfo)
    persistTimersRef.current.customerInfo = setTimeout(() => {
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
        deliveryAccuracyMeters: deliveryAccuracyMeters,
        deliveryLocationSource: deliveryLocationSource,
        deliveryFee: deliveryFee,
        deliveryFeePaidByBusiness: deliveryFeePaidByBusiness,
        scheduledFor: scheduledFor,
      }))
    }, STORAGE_DEBOUNCE_MS)
    return () => {
      if (persistTimersRef.current.customerInfo) clearTimeout(persistTimersRef.current.customerInfo)
    }
  }, [customerName, tableNumber, isReady, orderType, customerPhone, deliveryAreaId, deliveryAddress, deliveryLat, deliveryLng, deliveryAccuracyMeters, deliveryLocationSource, deliveryFee, deliveryFeePaidByBusiness, scheduledFor])

  // Flush pending writes before tab close/navigation to avoid data loss in debounce window.
  useEffect(() => {
    const flushPendingWrites = () => {
      localStorage.setItem('cart', JSON.stringify(items))
      if (cartTenant) localStorage.setItem(CART_TENANT_KEY, JSON.stringify(cartTenant))
      else localStorage.removeItem(CART_TENANT_KEY)
      if (orderTypeOptions) localStorage.setItem('orderTypeOptions', JSON.stringify(orderTypeOptions))
      else localStorage.removeItem('orderTypeOptions')
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
        deliveryAccuracyMeters: deliveryAccuracyMeters,
        deliveryLocationSource: deliveryLocationSource,
        deliveryFee: deliveryFee,
        deliveryFeePaidByBusiness: deliveryFeePaidByBusiness,
        scheduledFor: scheduledFor,
      }))
    }
    window.addEventListener('beforeunload', flushPendingWrites)
    return () => window.removeEventListener('beforeunload', flushPendingWrites)
  }, [items, cartTenant, orderTypeOptions, customerName, tableNumber, isReady, orderType, customerPhone, deliveryAreaId, deliveryAddress, deliveryLat, deliveryLng, deliveryAccuracyMeters, deliveryLocationSource, deliveryFee, deliveryFeePaidByBusiness, scheduledFor])


  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('deviceId', id)
    }
    setDeviceId(id)
  }, [])

  useEffect(() => {
    let active = true
    if (orderType === 'dine-in' && tableNumber && cartTenant?.slug && deviceId) {
      const channelName = `tenant-${cartTenant.slug}-table-${tableNumber}-cart`
      
      fetch(`/api/tenants/${cartTenant.slug}/table/${tableNumber}/cart`)
        .then(r => r.json())
        .then(data => {
          if (active && data && data.items) {
            setItems(data.items)
            setHostId(data.hostId)
          }
        })
        .catch(err => console.error('Failed to fetch shared cart:', err))

      const channel = pusherClient?.subscribe(channelName)
      channel?.bind('cart-updated', (data: any) => {
        if (active) {
          setItems(data.items)
          setHostId(data.hostId)
        }
      })
      channel?.bind('order-submitted', (data: { trackingToken: string }) => {
        if (active && data.trackingToken) {
          setItems([])
          setIsOpen(false)
          setTimeout(() => {
            router.replace(`/t/${cartTenant.slug}/track/${data.trackingToken}`)
          }, 0)
        }
      })

      return () => {
        active = false
        pusherClient?.unsubscribe(channelName)
      }
    } else {
      setHostId(null)
    }
  }, [orderType, tableNumber, cartTenant?.slug, deviceId, router, setIsOpen])

  const dispatchAtomicAction = useCallback((payload: any) => {
    if (orderType === 'dine-in' && tableNumber && cartTenant?.slug && deviceId) {
      fetch(`/api/tenants/${cartTenant.slug}/table/${tableNumber}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, deviceId, ownerName: customerName })
      }).catch(console.error)
    }
  }, [orderType, tableNumber, cartTenant?.slug, deviceId, customerName])

  const updateItems = useCallback((updater: React.SetStateAction<CartItem[]>) => {
    setItems((prevItems) => {
      const newItems = typeof updater === 'function' ? updater(prevItems) : updater
      return newItems
    })
  }, [])

  const doAddItem = useCallback((
    product: Product,
    selectedAddOns: string[],
    selectedVariants: (number | undefined)[],
    tenant: CartTenant | null,
    quantityToAdd = 1
  ) => {
    const addonsKey = (selectedAddOns || []).sort().join('-')
    const v = selectedVariants ?? []
    const variantsKey = v.length > 0 ? `v${v.map((x) => (x === undefined ? 'x' : x)).join('-')}` : ''
    const parts = [product._id]
    if (addonsKey) parts.push(addonsKey)
    if (variantsKey) parts.push(variantsKey)
    const cartItemId = parts.join('-')

    updateItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.cartItemId === cartItemId)
      if (existingItem) {
        return prevItems.map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + quantityToAdd } : item
        )
      }
      return [...prevItems, {
        ...product,
        cartItemId,
        quantity: quantityToAdd,
        notes: '',
        selectedAddOns: selectedAddOns || [],
        selectedVariants: selectedVariants ?? [],
      }]
    })

    dispatchAtomicAction({
      action: 'add_item',
      item: {
        ...product,
        cartItemId,
        quantity: quantityToAdd,
        notes: '',
        selectedAddOns: selectedAddOns || [],
        selectedVariants: selectedVariants ?? [],
      }
    })

    if (tenant) setCartTenant(tenant)
    showToast(t('Item added to cart!', 'تمت إضافة الصنف للسلة'), product.title_en || product.title_ar || 'Item')
  }, [t, showToast])

  const addToCart = (product: Product, selectedAddOns?: string[], selectedVariants?: (number | undefined)[], tenantContext?: CartTenant, orderTypeOptionsParam?: OrderTypeOptions, quantity?: number) => {
    const addons = selectedAddOns || []
    const variants = selectedVariants ?? []
    const qty = quantity ?? 1

    // Single-business rule: if cart has items from a different business, show conflict modal
    if (items.length > 0 && tenantContext && cartTenant) {
      if (cartTenant.slug === tenantContext.slug) {
        // Same business: still refresh tenant flags (e.g. free delivery toggled recently)
        doAddItem(product, addons, variants, tenantContext, qty)
        if (orderTypeOptionsParam) setOrderTypeOptions(orderTypeOptionsParam)
        return
      }
      setConflictState({
        cartTenant,
        newTenant: tenantContext,
        pending: { product, selectedAddOns: addons, selectedVariants: variants, quantity: qty },
      })
      return
    }

    const tenant = tenantContext ?? cartTenant
    doAddItem(product, addons, variants, tenant, qty)
    if (tenantContext && orderTypeOptionsParam) setOrderTypeOptions(orderTypeOptionsParam)
  }

  const resolveConflictReplace = useCallback(() => {
    if (!conflictState) return
    const { newTenant, pending } = conflictState
    updateItems([])
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
    setDeliveryFeePaidByBusiness(false)
    doAddItem(pending.product, pending.selectedAddOns || [], pending.selectedVariants ?? [], newTenant, pending.quantity ?? 1)
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

  const removeFromCart = useCallback((cartItemId: string) => {
    updateItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId))
    dispatchAtomicAction({ action: 'remove_item_any', cartItemId })
  }, [updateItems, dispatchAtomicAction])

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      updateItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId))
      dispatchAtomicAction({ action: 'remove_item_any', cartItemId })
      return
    }
    updateItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    )
    dispatchAtomicAction({ action: 'update_quantity', cartItemId, quantity })
  }, [updateItems, dispatchAtomicAction])

  const updateNotes = useCallback((cartItemId: string, notes: string) => {
    updateItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, notes } : item
      )
    )
    dispatchAtomicAction({ action: 'update_item', cartItemId, item: { notes } })
  }, [updateItems, dispatchAtomicAction])

  const updateAddOns = useCallback((cartItemId: string, selectedAddOns: string[]) => {
    const productId = cartItemId.split('-')[0]
    const addonsKey = (selectedAddOns || []).sort().join('-')
    const newCartItemId = addonsKey ? `${productId}-${addonsKey}` : productId

    updateItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, cartItemId: newCartItemId, selectedAddOns } : item
      )
    )
    
    // To rename the cartItemId on server, it might be tricky. The simplest way is remove and add again or just rely on Pusher sync if we don't want to overcomplicate.
    // For now, let's just send 'update_item' with the new AddOns, but wait, the ID changes. 
    // Let's do a remove and add atomic sequence locally by calling dispatch twice? 
    // Actually, `updateAddOns` is rarely used if at all (usually you remove the item and add a new one with new addons).
    // Let's send an update_item with the new cartItemId. The server will merge it into existing if it finds it by old cartItemId.
    dispatchAtomicAction({ action: 'update_item', cartItemId, item: { cartItemId: newCartItemId, selectedAddOns } })
  }, [updateItems, dispatchAtomicAction])

  const clearCart = useCallback(() => {
    updateItems([])
    setCartTenant(null)
    setIsReady(false)
    setCustomerName('')
    setTableNumber('')
    setOrderType(null)
    setCustomerPhone('')
    setDeliveryAreaId('')
    setDeliveryAddress('')
    setDeliveryFee(0)
    setDeliveryFeePaidByBusiness(false)
    setLockedTableNumber(null)
    // When clearing cart locally (e.g. order submitted or completely reset)
    // we also clear the table cart for everyone.
    dispatchAtomicAction({ action: 'clear_cart' })
  }, [updateItems, dispatchAtomicAction])

  const clearTableCart = useCallback(() => {
    dispatchAtomicAction({ action: 'clear_cart' })
  }, [dispatchAtomicAction])

  const joinTableSession = useCallback((tenant: CartTenant, tableId: string, options?: OrderTypeOptions) => {
    setCartTenant(tenant)
    setLockedTableNumber(tableId)
    setOrderType('dine-in')
    setTableNumber(tableId)
    if (options) {
      setOrderTypeOptions(options)
    }
  }, [setCartTenant, setLockedTableNumber, setOrderType, setTableNumber, setOrderTypeOptions])

  const leaveTable = useCallback(() => {
    dispatchAtomicAction({ action: 'leave_table' })
    updateItems([])
    setTableNumber('')
    setOrderType(null)
    setLockedTableNumber(null)
    setIsOpen(false)
    if (typeof window !== 'undefined' && cartTenant?.slug && lockedTableNumber) {
      try {
        sessionStorage.removeItem(`bedi-table-choice-seen-${cartTenant.slug}-${lockedTableNumber}`)
      } catch {
        // ignore
      }
    }
  }, [updateItems, dispatchAtomicAction, setTableNumber, setOrderType, setLockedTableNumber, setIsOpen, cartTenant?.slug, lockedTableNumber])

  const resetCartAndDisconnectCollaboration = useCallback(() => {
    const slugForStorage = cartTenant?.slug
    const tableKey = lockedTableNumber || tableNumber
    dispatchAtomicAction({ action: 'leave_table' })
    updateItems([])
    setCartTenant(null)
    setOrderTypeOptions(null)
    setIsReady(false)
    setCustomerName('')
    setTableNumber('')
    setOrderType(null)
    setCustomerPhone('')
    setDeliveryAreaId('')
    setDeliveryAddress('')
    setDeliveryFee(0)
    setDeliveryFeePaidByBusiness(false)
    setLockedTableNumber(null)
    clearDeliveryLocation()
    setScheduledFor(undefined)
    setIsOpen(false)
    if (typeof window !== 'undefined' && slugForStorage && tableKey) {
      try {
        sessionStorage.removeItem(`bedi-table-choice-seen-${slugForStorage}-${tableKey}`)
      } catch {
        // ignore
      }
    }
  }, [
    dispatchAtomicAction,
    updateItems,
    cartTenant?.slug,
    lockedTableNumber,
    tableNumber,
    clearDeliveryLocation,
  ])

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
        deviceId,
        hostId,
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
        deliveryAccuracyMeters,
        deliveryLocationSource,
        deliveryFee,
        setDeliveryFee,
        deliveryFeePaidByBusiness,
        setDeliveryFeePaidByBusiness,
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
        joinTableSession,
        leaveTable,
        clearTableCart,
        resetCartAndDisconnectCollaboration,
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
        overlayClassName="z-[600]"
        contentClassName="z-[600]"
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
