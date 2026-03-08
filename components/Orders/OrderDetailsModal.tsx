'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Package, Truck, UtensilsCrossed, Clock, User, Phone, MapPin, ChefHat, CheckCircle2, XCircle, MessageCircle, Edit2, Plus, Trash2, Save, RotateCcw, Settings, Flag, HandHelping, CreditCard, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { client } from '@/sanity/lib/client'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { SlideToCompleteOrder } from './SlideToCompleteOrder'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'

interface OrderItem {
  _key: string
  productName: string
  quantity: number
  price: number
  total: number
  notes?: string
  addOns?: string
}

interface Driver {
  _id: string
  name: string
  phoneNumber: string
  vehicleType?: string
  isActive: boolean
  isOnline?: boolean
  deliveryAreas?: Array<{
    _id: string
    name_en: string
    name_ar: string
  }>
  lastKnownLat?: number
  lastKnownLng?: number
  lastLocationAt?: string
}

interface Order {
  _id: string
  orderNumber: string
  orderType: 'receive-in-person' | 'dine-in' | 'delivery'
  status: 'new' | 'acknowledged' | 'preparing' | 'waiting_for_delivery' | 'driver_on_the_way' | 'out-for-delivery' | 'completed' | 'served' | 'cancelled' | 'refunded'
  customerName: string
  tableNumber?: string
  customerPhone?: string
  customerRequestedAt?: string
  customerRequestAcknowledgedAt?: string
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  deliveryArea?: {
    _id: string
    name_en: string
    name_ar: string
  }
  deliveryAddress?: string
  deliveryFee?: number
  assignedDriver?: {
    _id: string
    name: string
    phoneNumber: string
    deliveryAreas?: Array<{
      _id: string
      name_en: string
      name_ar: string
    }>
  }
  items: OrderItem[]
  subtotal: number
  totalAmount: number
  currency: string
  createdAt: string
  scheduledFor?: string
  acknowledgedAt?: string
  notifyAt?: string
  reminderSent?: boolean
  preparedAt?: string
  driverAcceptedAt?: string
  driverPickedUpAt?: string
  completedAt?: string
  cancelledAt?: string
  driverCancelledAt?: string
}

interface OrderDetailsModalProps {
  order: Order
  onClose: () => void
  onStatusUpdate: (orderId: string, status: string, notifyAt?: string, newScheduledFor?: string) => void | Promise<void>
  onRefresh: () => void
  /** Called after order items are saved so parent can update its order list and selected order. Prevents revert when parent refetches. */
  onOrderUpdated?: (updatedOrder: Order) => void
  /** When set, update-items and assign-driver use tenant-scoped APIs */
  tenantSlug?: string
  /** Called when staff acknowledges table request (stops ringing, notifies customer) */
  onAcknowledgeTableRequest?: (orderId: string) => void
}

function TableRequestBanner({
  order,
  onAcknowledge,
  t,
}: {
  order: Order
  onAcknowledge: () => void | Promise<void>
  t: (en: string, ar: string) => string
}) {
  const [loading, setLoading] = useState(false)
  const isHelp = order.customerRequestType === 'call_waiter'
  const paymentLabel = order.customerRequestPaymentMethod === 'cash' ? t('Cash', 'نقداً') : t('Card', 'بطاقة')
  return (
    <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 relative z-20">
      <div className="flex items-center gap-3">
        {isHelp ? (
          <HandHelping className="w-8 h-8 text-amber-700 shrink-0" />
        ) : (
          <CreditCard className="w-8 h-8 text-amber-700 shrink-0" />
        )}
        <div>
          <p className="font-black text-amber-900">
            {order.tableNumber ? t('Table', 'طاولة') + ` ${order.tableNumber}` : t('Customer', 'العميل')} —{' '}
            {isHelp ? t('Needs help', 'يحتاج مساعدة') : t('Wants to pay', 'يريد الدفع') + ` (${paymentLabel})`}
          </p>
          <p className="text-sm text-amber-800">{t('Tap Okay when you\'re on it — ringing will stop.', 'اضغط موافق عندما تصل — سيتوقف الرنين.')}</p>
        </div>
      </div>
      <Button
        type="button"
        onClick={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          setLoading(true)
          await Promise.resolve(onAcknowledge())
          setLoading(false)
        }}
        disabled={loading}
        className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 cursor-pointer touch-manipulation relative z-30"
      >
        <Check className="w-4 h-4 mr-2" />
        {t('Okay', 'موافق')}
      </Button>
    </div>
  )
}

/** Status steps (delivery-only steps hidden for dine-in and receive-in-person) */
const STATUS_STEP_OPTIONS = [
  { value: 'preparing', labelEn: 'Preparing', labelAr: 'قيد التحضير', icon: ChefHat, color: 'bg-orange-500' },
  { value: 'waiting_for_delivery', labelEn: 'Waiting for Delivery', labelAr: 'في انتظار التوصيل', icon: Clock, color: 'bg-amber-500' },
  { value: 'driver_on_the_way', labelEn: 'Driver on the way to pick up', labelAr: 'السائق في الطريق لاستلام الطلب', icon: Truck, color: 'bg-blue-500' },
  { value: 'out-for-delivery', labelEn: 'Driver on the way to you', labelAr: 'السائق في الطريق إليك', icon: Truck, color: 'bg-purple-500' },
]
const DELIVERY_ONLY_STATUS_VALUES = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']

interface ProductVariantOption {
  label_en: string
  label_ar: string
  priceModifier?: number
}
interface ProductVariantGroup {
  name_en: string
  name_ar: string
  required?: boolean
  options: ProductVariantOption[]
}
interface Product {
  _id: string
  title_en: string
  title_ar: string
  price: number
  specialPrice?: number
  specialPriceExpires?: string
  currency: string
  addOns?: Array<{
    name_en: string
    name_ar: string
    price: number
  }>
  variants?: ProductVariantGroup[]
}

function normalizeVariants(raw: unknown): ProductVariantGroup[] {
  if (!Array.isArray(raw)) return []
  return raw.map((g: Record<string, unknown>) => {
    const options = Array.isArray(g.options)
      ? (g.options as Record<string, unknown>[]).map((o) => ({
          label_en: (o.label_en as string) ?? '',
          label_ar: (o.label_ar as string) ?? '',
          priceModifier: o.priceModifier != null ? Number(o.priceModifier) : undefined,
        }))
      : []
    return {
      name_en: (g.name_en as string) ?? '',
      name_ar: (g.name_ar as string) ?? '',
      required: g.required === true,
      options,
    }
  }).filter((g) => g.options.length > 0)
}

export function OrderDetailsModal({ order, onClose, onStatusUpdate, onRefresh, onOrderUpdated, tenantSlug, onAcknowledgeTableRequest }: OrderDetailsModalProps) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [reminderMinutes, setReminderMinutes] = useState(60)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [newScheduleDate, setNewScheduleDate] = useState('')
  const [showDriverSelector, setShowDriverSelector] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [showOfflineDrivers, setShowOfflineDrivers] = useState(false)
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null)
  const [requestingDriver, setRequestingDriver] = useState(false)
  const [unassigningDriver, setUnassigningDriver] = useState(false)
  const [localOrder, setLocalOrder] = useState<Order>(order)
  const [isEditing, setIsEditing] = useState(false)
  const [editingItems, setEditingItems] = useState<OrderItem[]>(order.items)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productToConfigure, setProductToConfigure] = useState<Product | null>(null)
  const [addItemQuantity, setAddItemQuantity] = useState(1)
  /** For variant groups: groupIndex -> optionIndex (optional groups use -1 for "None") */
  const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<number, number>>({})
  /** Indices of selected add-ons */
  const [selectedAddOnIndices, setSelectedAddOnIndices] = useState<number[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'cancelled' | 'refunded' | null>(null)
  const [businessLocation, setBusinessLocation] = useState<{ country?: string; city?: string; mapsLink?: string } | null>(null)
  const [loadingBusinessLocation, setLoadingBusinessLocation] = useState(false)
  const [reportTarget, setReportTarget] = useState<'driver' | 'customer' | null>(null)

  const orderTime = new Date(localOrder.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const fetchDrivers = async () => {
    setLoadingDrivers(true)
    try {
      if (tenantSlug) {
        const res = await fetch(`/api/tenants/${tenantSlug}/drivers`)
        const data = (await res.json()) ?? []
        const list = (Array.isArray(data) ? data : []).map(
          (d: {
            _id: string
            name: string
            nickname?: string
            phoneNumber: string
            vehicleType?: string
            isOnline?: boolean
            deliveryAreas?: Array<{ _id: string; name_en: string; name_ar: string }>
            lastKnownLat?: number
            lastKnownLng?: number
            lastLocationAt?: string
          }) => ({
            _id: d._id,
            name: (d.nickname?.trim() || d.name).trim() || d.name,
            phoneNumber: d.phoneNumber,
            vehicleType: d.vehicleType,
            isActive: true,
            isOnline: d.isOnline,
            deliveryAreas: d.deliveryAreas ?? [],
            lastKnownLat: d.lastKnownLat,
            lastKnownLng: d.lastKnownLng,
            lastLocationAt: d.lastLocationAt,
          })
        )
        setDrivers(list)
      } else {
        const query = `*[_type == "driver" && isActive == true] | order(name asc) {
          _id,
          name,
          phoneNumber,
          vehicleType,
          isActive,
          deliveryAreas[]->{_id, name_en, name_ar}
        }`
        const result = await client.fetch(query)
        setDrivers(result ?? [])
      }
    } catch (error) {
      console.error('Failed to fetch drivers:', error)
    } finally {
      setLoadingDrivers(false)
    }
  }

  const handleOrderACaptain = () => {
    if (drivers.length === 0) {
      fetchDrivers()
    }
    setShowDriverSelector(true)
  }

  // Sync from order prop only when not editing, so we don't overwrite user's in-progress edits or just-saved state
  useEffect(() => {
    if (!isEditing) {
      setLocalOrder(order)
      setEditingItems(order.items)
    }
  }, [order, isEditing])

  // Fetch business country/city when delivery order and tenant — required to allow request driver
  useEffect(() => {
    if (order.orderType !== 'delivery' || !tenantSlug) {
      setBusinessLocation(null)
      return
    }
    setLoadingBusinessLocation(true)
    fetch(`/api/tenants/${tenantSlug}/business`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { tenant?: { country?: string; city?: string }; restaurantInfo?: { mapsLink?: string } }) => {
        const tenant = data?.tenant
        const mapsLink = data?.restaurantInfo?.mapsLink
        setBusinessLocation(
          tenant
            ? { country: tenant.country ?? '', city: tenant.city ?? '', mapsLink: mapsLink ?? undefined }
            : null
        )
      })
      .catch(() => setBusinessLocation(null))
      .finally(() => setLoadingBusinessLocation(false))
  }, [order.orderType, tenantSlug])

  // Fetch products for adding new items (only from this tenant when tenantSlug is set)
  const fetchProducts = async () => {
    if (products.length > 0) return // Already fetched
    if (!tenantSlug) {
      showToast(t('Adding items is only available from your business orders page.', 'إضافة أصناف متاحة فقط من صفحة طلبات عملك.'), '', 'error')
      return
    }

    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/products`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const list = await res.json()
      const mapped: Product[] = (Array.isArray(list) ? list : []).map((p: Record<string, unknown>) => ({
        _id: p._id as string,
        title_en: (p.title_en as string) ?? '',
        title_ar: (p.title_ar as string) ?? '',
        price: Number(p.price) ?? 0,
        specialPrice: p.specialPrice != null ? Number(p.specialPrice) : undefined,
        specialPriceExpires: typeof p.specialPriceExpires === 'string' ? p.specialPriceExpires : undefined,
        currency: (p.currency as string) ?? 'ILS',
        addOns: Array.isArray(p.addOns) ? p.addOns as Product['addOns'] : undefined,
        variants: normalizeVariants(p.variants),
      }))
      setProducts(mapped)
    } catch (error) {
      console.error('Failed to fetch products:', error)
      showToast(t('Failed to load products.', 'فشل تحميل المنتجات.'), '', 'error')
    } finally {
      setLoadingProducts(false)
    }
  }

  // Calculate totals from items
  const calculateTotals = (items: OrderItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const deliveryFee = localOrder.deliveryFee || 0
    const totalAmount = subtotal + deliveryFee
    return { subtotal, totalAmount }
  }

  // Update item quantity
  const updateItemQuantity = (itemKey: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setEditingItems(prev => prev.map(item => {
      if (item._key === itemKey) {
        const total = item.price * newQuantity
        return { ...item, quantity: newQuantity, total }
      }
      return item
    }))
  }

  // Update item notes
  const updateItemNotes = (itemKey: string, notes: string) => {
    setEditingItems(prev => prev.map(item => {
      if (item._key === itemKey) {
        return { ...item, notes: notes || undefined }
      }
      return item
    }))
  }

  // Remove item
  const removeItem = (itemKey: string) => {
    setEditingItems(prev => prev.filter(item => item._key !== itemKey))
  }

  const getProductBasePrice = (product: Product) =>
    product.specialPrice && product.specialPriceExpires && new Date(product.specialPriceExpires) > new Date()
      ? product.specialPrice
      : product.price

  const hasOptions = (product: Product) =>
    (product.variants && product.variants.length > 0) || (product.addOns && product.addOns.length > 0)

  /** Compute unit price for a product with given variant/add-on selections (for display and order line). */
  const computeOptionPrice = (
    product: Product,
    variantSelections: Record<number, number>,
    addOnIndices: number[]
  ): number => {
    let unit = getProductBasePrice(product)
    const variants = product.variants ?? []
    variants.forEach((group, gi) => {
      const optIdx = variantSelections[gi]
      if (optIdx != null && optIdx >= 0 && group.options[optIdx]) {
        unit += group.options[optIdx].priceModifier ?? 0
      }
    })
    const addOns = product.addOns ?? []
    addOnIndices.forEach((idx) => {
      if (addOns[idx]) unit += addOns[idx].price ?? 0
    })
    return unit
  }

  // Add new item (no options, or after options configured)
  const addItem = (product: Product) => {
    if (hasOptions(product)) {
      setProductToConfigure(product)
      setAddItemQuantity(1)
      const initialVariants: Record<number, number> = {}
      ;(product.variants ?? []).forEach((group, gi) => {
        initialVariants[gi] = group.required && group.options.length ? 0 : -1
      })
      setSelectedVariantOptions(initialVariants)
      setSelectedAddOnIndices([])
      return
    }

    const currentPrice = getProductBasePrice(product)
    const newItem: OrderItem = {
      _key: `item-${Date.now()}-${Math.random()}`,
      productName: product.title_en,
      quantity: 1,
      price: currentPrice,
      total: currentPrice,
    }
    setEditingItems(prev => [...prev, newItem])
    setShowAddProduct(false)
  }

  const addItemWithOptions = () => {
    const product = productToConfigure
    if (!product) return
    const variants = product.variants ?? []
    const addOns = product.addOns ?? []
    const unitPrice = computeOptionPrice(product, selectedVariantOptions, selectedAddOnIndices)

    const optionParts: string[] = []
    variants.forEach((group, gi) => {
      const optIdx = selectedVariantOptions[gi]
      if (optIdx != null && optIdx >= 0 && group.options[optIdx]) {
        const label = lang === 'ar' ? group.options[optIdx].label_ar : group.options[optIdx].label_en
        optionParts.push(`${lang === 'ar' ? group.name_ar : group.name_en}: ${label}`)
      }
    })
    const addOnNames = selectedAddOnIndices
      .map((i) => (lang === 'ar' ? addOns[i]?.name_ar : addOns[i]?.name_en))
      .filter(Boolean)
    if (addOnNames.length) optionParts.push(addOnNames.join(', '))

    const productName = product.title_en + (optionParts.length ? ` (${optionParts.join('; ')})` : '')
    const total = unitPrice * addItemQuantity

    const newItem: OrderItem = {
      _key: `item-${Date.now()}-${Math.random()}`,
      productName,
      quantity: addItemQuantity,
      price: unitPrice,
      total,
      notes: optionParts.length ? optionParts.join('; ') : undefined,
      addOns: addOnNames.length ? addOnNames.join(', ') : undefined,
    }
    setEditingItems(prev => [...prev, newItem])
    setShowAddProduct(false)
    setProductToConfigure(null)
  }

  // Save order changes
  const saveOrderChanges = async () => {
    setSaving(true)
    try {
      const { subtotal, totalAmount } = calculateTotals(editingItems)

      const updateItemsUrl = tenantSlug
        ? `/api/tenants/${tenantSlug}/orders/update-items`
        : '/api/orders/update-items'
      const response = await fetch(updateItemsUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: localOrder._id,
          items: editingItems,
          subtotal,
          totalAmount,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      const updatedOrder: Order = {
        ...localOrder,
        items: editingItems,
        subtotal,
        totalAmount,
      }
      setLocalOrder(updatedOrder)
      setEditingItems(editingItems)
      setIsEditing(false)
      onOrderUpdated?.(updatedOrder)
      showToast(t('Order updated successfully!', 'تم تحديث الطلب بنجاح!'), '', 'success')
      onRefresh()
    } catch (error) {
      console.error('Failed to update order:', error)
      showToast('Failed to update order', 'فشل تحديث الطلب', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingItems(localOrder.items)
    setIsEditing(false)
    setShowAddProduct(false)
    setProductToConfigure(null)
  }

  const assignDriver = async (driverId: string) => {
    setAssigningDriverId(driverId)
    try {
      const assignDriverUrl = tenantSlug
        ? `/api/tenants/${tenantSlug}/orders/assign-driver`
        : '/api/orders/assign-driver'
      const response = await fetch(assignDriverUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: localOrder._id,
          driverId: driverId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign driver')
      }

      // Find the assigned driver from the drivers list to update optimistically
      const assignedDriver = drivers.find(d => d._id === driverId)
      if (assignedDriver) {
        // Optimistically update local order state
        setLocalOrder(prev => ({
          ...prev,
          assignedDriver: {
            _id: assignedDriver._id,
            name: assignedDriver.name,
            phoneNumber: assignedDriver.phoneNumber,
            deliveryAreas: assignedDriver.deliveryAreas,
          },
          status: 'out-for-delivery' as const,
        }))
      }

      // Call onRefresh to trigger parent component update
      onRefresh()
      setShowDriverSelector(false)
      showToast(
        'Driver assigned successfully!',
        'تم تعيين السائق بنجاح!',
        'success'
      )
      onClose()
    } catch (error) {
      console.error('Failed to assign driver:', error)
      showToast(
        'Failed to assign driver. Please try again.',
        'فشل تعيين السائق. يرجى المحاولة مرة أخرى.',
        'error'
      )
    } finally {
      setAssigningDriverId(null)
    }
  }

  const requestDelivery = async () => {
    if (!tenantSlug) return
    setRequestingDriver(true)
    try {
      const res = await fetch(`/api/tenants/${tenantSlug}/orders/request-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: localOrder._id }),
      })
      if (!res.ok) throw new Error('Failed to request delivery')
      onRefresh()
      showToast('Delivery requested. Captains in your area will see this order.', 'تم طلب التوصيل. سيرى الكباتن في منطقتك الطلب.', 'success')
      onClose()
    } catch {
      showToast('Failed to request delivery. Please try again.', 'فشل طلب التوصيل. يرجى المحاولة مرة أخرى.', 'error')
    } finally {
      setRequestingDriver(false)
    }
  }

  const unassignDriver = async () => {
    if (!tenantSlug) return
    setUnassigningDriver(true)
    try {
      const res = await fetch(`/api/tenants/${tenantSlug}/orders/unassign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: localOrder._id }),
      })
      if (!res.ok) throw new Error('Failed to unassign driver')
      setLocalOrder(prev => ({ ...prev, assignedDriver: undefined, status: 'preparing' as const }))
      onRefresh()
      setShowDriverSelector(false)
      showToast('Driver unassigned. You can request delivery again or assign someone else.', 'تم إلغاء تعيين السائق. يمكنك طلب توصيل جديد أو تعيين سائق آخر.', 'success')
    } catch {
      showToast('Failed to unassign driver. Please try again.', 'فشل إلغاء تعيين السائق. يرجى المحاولة مرة أخرى.', 'error')
    } finally {
      setUnassigningDriver(false)
    }
  }

  const sendWhatsAppToCustomer = () => {
    if (!localOrder.customerPhone) return

    const itemsList = localOrder.items
      .map(
        (item) =>
          `• ${item.quantity}x ${item.productName}${item.addOns ? ` (${item.addOns})` : ''}${item.notes ? ` 📝 ${item.notes}` : ''}`
      )
      .join('\n')
    const deliveryFeeLine =
      localOrder.deliveryFee && localOrder.deliveryFee > 0
        ? `Delivery fee / رسوم التوصيل: ${localOrder.deliveryFee.toFixed(2)} ${formatCurrency(localOrder.currency)}\n`
        : ''
    const orderDetails = `
✅ Order confirmation / تأكيد الطلب
━━━━━━━━━━━━━━━━━━━━━━

Order # / الطلب: ${localOrder.orderNumber}

Name / الاسم: ${localOrder.customerName}
${localOrder.deliveryArea ? `Area / المنطقة: ${localOrder.deliveryArea.name_en || ''} | ${localOrder.deliveryArea.name_ar || ''}\n` : ''}${localOrder.deliveryAddress ? `Address / العنوان: ${localOrder.deliveryAddress}\n` : ''}

Items / الطلبات:
${itemsList}

${deliveryFeeLine}Total / المجموع: ${localOrder.totalAmount.toFixed(2)} ${formatCurrency(localOrder.currency)}

━━━━━━━━━━━━━━━━━━━━━━
Please confirm the details above. Reply "Yes" or "نعم" to confirm.
يرجى التأكد من التفاصيل أعلاه. الرد "نعم" للتأكيد.
Thank you! 🙏 شكراً لكم
    `.trim()

    const message = orderDetails
    const whatsappUrl = getWhatsAppUrl(localOrder.customerPhone, message)
    if (whatsappUrl) window.open(whatsappUrl, '_blank')
  }

  const sendWhatsAppToDriver = (driver: { name: string; phoneNumber: string }) => {
    const itemsList = localOrder.items
      .map((item) => `${item.quantity}x ${item.productName}${item.notes ? ` (${item.notes})` : ''}`)
      .join('\n')
    const deliveryFeeLine =
      localOrder.deliveryFee && localOrder.deliveryFee > 0
        ? `Delivery fee / رسوم التوصيل: ${localOrder.deliveryFee.toFixed(2)} ${formatCurrency(localOrder.currency)}\n`
        : ''
    const orderDetails = `
🚗 New delivery request / طلب توصيل جديد
━━━━━━━━━━━━━━━━━━━━━━

Order # / الطلب: ${localOrder.orderNumber}

Customer / العميل: ${localOrder.customerName}
Phone / الجوال: ${localOrder.customerPhone}
Area / المنطقة: ${localOrder.deliveryArea?.name_en || ''} | ${localOrder.deliveryArea?.name_ar || '—'}
Address / العنوان: ${localOrder.deliveryAddress || '—'}

Items / الطلبات:
${itemsList}

${deliveryFeeLine}Total / المجموع: ${localOrder.totalAmount.toFixed(2)} ${formatCurrency(localOrder.currency)}

━━━━━━━━━━━━━━━━━━━━━━
Please deliver this order to the customer.
يرجى توصيل هذا الطلب إلى العميل.
    `.trim()

    const whatsappUrl = getWhatsAppUrl(driver.phoneNumber, orderDetails)
    if (whatsappUrl) window.open(whatsappUrl, '_blank')
  }

  const statusLabel = (opt: (typeof STATUS_STEP_OPTIONS)[0]) => t(opt.labelEn, opt.labelAr)

  const canChangeStatus = localOrder.status !== 'completed' && localOrder.status !== 'served' && localOrder.status !== 'cancelled' && localOrder.status !== 'refunded'
  const isDineIn = localOrder.orderType === 'dine-in'
  // Dine-in: Complete is shown only when business confirms payment; keep slider visible when status is Served
  const showCompleteSlider = canChangeStatus || (isDineIn && localOrder.status === 'served')
  const handleConfirmStatus = async (status: 'cancelled' | 'refunded') => {
    await Promise.resolve(onStatusUpdate(localOrder._id, status))
    setConfirmAction(null)
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white text-slate-900 rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-xl relative z-10 overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
          {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {order.orderType === 'delivery' ? (
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-blue-600" />
                </div>
              )}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
                  <h2 className="text-2xl font-black text-slate-900">{t('Order', 'الطلب')} #{localOrder.orderNumber}</h2>
                  {/* Manual Rescheduling Button (Available for all orders not completed/cancelled) */}
                  {!['completed', 'cancelled', 'refunded'].includes(localOrder.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewScheduleDate(localOrder.scheduledFor ? new Date(new Date(localOrder.scheduledFor).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '')
                        setIsEditingSchedule(!isEditingSchedule)
                      }}
                      className={`h-9 px-3 rounded-xl font-bold shadow-sm flex items-center gap-2 ${localOrder.scheduledFor ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {localOrder.scheduledFor ? (
                        <>
                          <Edit2 className="w-4 h-4" />
                          {isEditingSchedule ? t('Cancel Reschedule', 'إلغاء الجدولة') : t('Edit Schedule Time', 'تعديل وقت الجدولة')}
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4" />
                          {t('Set as Scheduled Order', 'تعيين كطلب مجدول')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {orderTime}
                </p>
              </div>
            </div>
            
            {/* Global Rescheduling UI */}
            {isEditingSchedule && !['completed', 'cancelled', 'refunded'].includes(localOrder.status) && (
              <div className="mt-4 mb-6 p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 pointer-events-none">
                  <Clock className="w-24 h-24 text-purple-600" />
                </div>
                <div className="relative z-10">
                  <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    {localOrder.scheduledFor ? t('Reschedule Order', 'إعادة جدولة الطلب') : t('Schedule Order', 'جدولة الطلب')}
                  </h4>
                  <p className="text-xs font-medium text-purple-700 mb-3 bg-purple-100/50 p-2 rounded-lg border border-purple-200/50">
                    ℹ️ {t('Customer will be notified of this change via push notification.', 'سيتم إشعار العميل بهذا التغيير عبر إشعار نصي.')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="datetime-local"
                      value={newScheduleDate}
                      onChange={(e) => setNewScheduleDate(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-purple-200 bg-white text-sm font-semibold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <Button 
                      onClick={async () => {
                        if (newScheduleDate) {
                          // Determine the status: if it was a live order (new without scheduledFor), move to acknowledged
                          // If it was already scheduled, keep its current status (or move to acknowledged if preferred, but usually keep current)
                          const targetStatus = (!localOrder.scheduledFor && localOrder.status === 'new') ? 'acknowledged' : localOrder.status;
                          await onStatusUpdate(localOrder._id, targetStatus, undefined, new Date(newScheduleDate).toISOString());
                          setIsEditingSchedule(false);
                        }
                      }}
                      disabled={!newScheduleDate || newScheduleDate === localOrder.scheduledFor?.slice(0, 16)}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-6 font-bold shadow-sm whitespace-nowrap"
                    >
                      <Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {t('Save Schedule', 'حفظ الجدولة')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
            aria-label={t('Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Table request banner — dine-in: customer asked for help or check */}
        {localOrder.orderType === 'dine-in' && localOrder.customerRequestedAt && !localOrder.customerRequestAcknowledgedAt && (
          <TableRequestBanner
            order={localOrder}
            onAcknowledge={async () => {
              try {
                const url = tenantSlug 
                  ? `/api/tenants/${tenantSlug}/orders/status` 
                  : `/api/orders/status`
                const res = await fetch(url, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: localOrder._id, acknowledgeTableRequest: true }),
                })
                if (res.ok) {
                  const now = new Date().toISOString()
                  setLocalOrder(prev => ({ ...prev, customerRequestAcknowledgedAt: now }))
                  if (onAcknowledgeTableRequest) {
                    onAcknowledgeTableRequest(localOrder._id)
                  }
                  if (onOrderUpdated) {
                    onOrderUpdated({ ...localOrder, customerRequestAcknowledgedAt: now })
                  }
                  showToast(t('Request acknowledged', 'تم الرد على الطلب'), '', 'success')
                } else {
                  showToast(t('Failed to acknowledge request', 'فشل الرد على الطلب'), '', 'error')
                }
              } catch (e) {
                console.error('Failed to acknowledge table request:', e)
                showToast(t('Failed to acknowledge request', 'فشل الرد على الطلب'), '', 'error')
              }
            }}
            t={t}
          />
        )}

        {/* Customer Information */}
        <div className="bg-slate-50 rounded-2xl p-6 mb-6">
          <h3 className="font-black text-lg text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-700" />
            {t('Customer Information', 'معلومات العميل')}
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-600 uppercase font-bold mb-1">{t('Name', 'الاسم')}</p>
              <p className="font-bold text-lg text-slate-900">{localOrder.customerName}</p>
            </div>

            {(localOrder.orderType === 'dine-in' || localOrder.orderType === 'receive-in-person') && localOrder.customerPhone && (
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {t('WhatsApp / Phone', 'واتساب / الجوال')}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-lg text-slate-900">{localOrder.customerPhone}</p>
                  <Button
                    onClick={() => sendWhatsAppToCustomer()}
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    title={t('Send WhatsApp message', 'إرسال رسالة واتساب')}
                  >
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </Button>
                </div>
              </div>
            )}

            {localOrder.orderType === 'dine-in' && localOrder.tableNumber && (
              <div>
                <p className="text-xs text-slate-600 uppercase font-bold mb-1">{t('Table Number', 'رقم الطاولة')}</p>
                <p className="font-bold text-lg text-slate-900">{localOrder.tableNumber}</p>
              </div>
            )}

            {localOrder.orderType === 'delivery' && (
              <>
                {localOrder.customerPhone && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-bold mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {t('Phone', 'الجوال')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-lg text-slate-900">{localOrder.customerPhone}</p>
                      <Button
                        onClick={() => sendWhatsAppToCustomer()}
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        title={t('Send WhatsApp message', 'إرسال رسالة واتساب')}
                      >
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </div>
                )}
                {localOrder.deliveryArea && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-bold mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {t('Delivery Area', 'منطقة التوصيل')}
                    </p>
                    <p className="font-bold text-slate-900">{lang === 'ar' ? localOrder.deliveryArea.name_ar : localOrder.deliveryArea.name_en}</p>
                  </div>
                )}
                {localOrder.deliveryAddress && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase font-bold mb-1">{t('Delivery Address', 'عنوان التوصيل')}</p>
                    <p className="text-sm text-slate-800">{localOrder.deliveryAddress}</p>
                  </div>
                )}
              </>
            )}
            {tenantSlug && (
              <div className="pt-3 mt-3 border-t border-slate-200">
                <Button
                  onClick={() => setReportTarget('customer')}
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  <Flag className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0" />
                  {t('Report customer', 'الإبلاغ عن العميل')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-700" />
              {t('Order Items', 'عناصر الطلب')} ({isEditing ? editingItems.length : localOrder.items.length})
            </h3>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="rounded-xl"
              >
                <Edit2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Edit Items', 'تعديل العناصر')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={cancelEditing}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  {t('Cancel', 'إلغاء')}
                </Button>
                <Button
                  onClick={saveOrderChanges}
                  size="sm"
                  className="rounded-xl bg-green-600 hover:bg-green-700"
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {saving ? t('Saving...', 'جارٍ الحفظ...') : t('Save Changes', 'حفظ التغييرات')}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {(isEditing ? editingItems : localOrder.items).map((item) => (
              <div key={item._key} className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => updateItemQuantity(item._key, item.quantity - 1)}
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                            disabled={item.quantity <= 1}
                          >
                            -
                          </Button>
                          <span className="font-black text-lg text-slate-600 w-8 text-center">{item.quantity}x</span>
                          <Button
                            onClick={() => updateItemQuantity(item._key, item.quantity + 1)}
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <span className="font-black text-lg text-slate-600">{item.quantity}x</span>
                      )}
                      <h4 className="font-bold text-lg text-slate-900">{item.productName}</h4>
                      {isEditing && (
                        <Button
                          onClick={() => removeItem(item._key)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {item.addOns && (
                      <p className="text-sm text-slate-700 ml-8 mb-1">
                        {item.addOns}
                      </p>
                    )}
                    {isEditing ? (
                      <div className="ml-8 rtl:mr-8 rtl:ml-0 mt-2">
                        <Input
                          placeholder={t('Add notes (optional)', 'إضافة ملاحظات (اختياري)')}
                          value={item.notes || ''}
                          onChange={(e) => updateItemNotes(item._key, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    ) : item.notes ? (
                      <div className="ml-8 rtl:mr-8 rtl:ml-0 mt-2 p-2 bg-amber-50 border-l-4 rtl:border-r-4 rtl:border-l-0 border-amber-400 rounded-r rtl:rounded-l rtl:rounded-r-none">
                        <p className="text-sm text-amber-900 flex items-start gap-2">
                          <span>📝</span>
                          <span>{item.notes}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600 mb-1">
                      {item.price.toFixed(2)} {formatCurrency(localOrder.currency)} × {item.quantity}
                    </p>
                    <p className="font-black text-xl text-slate-900">
                      {item.total.toFixed(2)} {formatCurrency(localOrder.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isEditing && (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4">
                {!showAddProduct ? (
                  <Button
                    onClick={() => {
                      fetchProducts()
                      setShowAddProduct(true)
                    }}
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled={loadingProducts}
                  >
                    <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                    {loadingProducts ? t('Loading products...', 'جارٍ تحميل المنتجات...') : t('Add Item', 'إضافة صنف')}
                  </Button>
                ) : productToConfigure ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold">{lang === 'ar' ? productToConfigure.title_ar : productToConfigure.title_en}</h4>
                      <Button
                        onClick={() => { setProductToConfigure(null) }}
                        variant="ghost"
                        size="sm"
                        aria-label={t('Back', 'رجوع')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t('Quantity', 'الكمية')}:</span>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={addItemQuantity}
                        onChange={(e) => setAddItemQuantity(Math.max(1, parseInt(String(e.target.value), 10) || 1))}
                        className="w-20"
                      />
                    </div>
                    {(productToConfigure.variants ?? []).map((group, gi) => (
                      <div key={gi} className="space-y-1">
                        <p className="text-sm font-medium text-slate-700">
                          {lang === 'ar' ? group.name_ar : group.name_en}
                          {group.required ? ` (${t('Required', 'مطلوب')})` : ''}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {!group.required && (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`variant-${gi}`}
                                checked={selectedVariantOptions[gi] === -1}
                                onChange={() => setSelectedVariantOptions(prev => ({ ...prev, [gi]: -1 }))}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">{t('None', 'لا شيء')}</span>
                            </label>
                          )}
                          {group.options.map((opt, oi) => (
                            <label key={oi} className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`variant-${gi}`}
                                checked={selectedVariantOptions[gi] === oi}
                                onChange={() => setSelectedVariantOptions(prev => ({ ...prev, [gi]: oi }))}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">{lang === 'ar' ? opt.label_ar : opt.label_en}</span>
                              {(opt.priceModifier ?? 0) !== 0 && (
                                <span className="text-xs text-slate-500">
                                  {opt.priceModifier! > 0 ? '+' : ''}{opt.priceModifier!.toFixed(2)} {formatCurrency(productToConfigure.currency)}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(productToConfigure.addOns ?? []).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700">{t('Add-ons', 'الإضافات')}</p>
                        <div className="flex flex-wrap gap-2">
                          {productToConfigure.addOns!.map((addOn, ai) => (
                            <label key={ai} className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedAddOnIndices.includes(ai)}
                                onChange={(e) => {
                                  setSelectedAddOnIndices(prev =>
                                    e.target.checked ? [...prev, ai] : prev.filter((i) => i !== ai)
                                  )
                                }}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm">{lang === 'ar' ? addOn.name_ar : addOn.name_en}</span>
                              {(addOn.price ?? 0) !== 0 && (
                                <span className="text-xs text-slate-500">
                                  +{addOn.price!.toFixed(2)} {formatCurrency(productToConfigure.currency)}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-semibold text-slate-800">
                      {t('Unit price', 'سعر الوحدة')}: {computeOptionPrice(productToConfigure, selectedVariantOptions, selectedAddOnIndices).toFixed(2)} {formatCurrency(productToConfigure.currency)}
                      {' · '}
                      {t('Total', 'المجموع')}: {(computeOptionPrice(productToConfigure, selectedVariantOptions, selectedAddOnIndices) * addItemQuantity).toFixed(2)} {formatCurrency(productToConfigure.currency)}
                    </p>
                    <Button onClick={addItemWithOptions} className="w-full rounded-xl">
                      {t('Add to order', 'إضافة للطلب')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold">{t('Select Product', 'اختر المنتج')}</h4>
                      <Button
                        onClick={() => { setShowAddProduct(false); setProductToConfigure(null) }}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {products.map((product) => {
                        const currentPrice = getProductBasePrice(product)

                        return (
                          <button
                            key={product._id}
                            onClick={() => addItem(product)}
                            className="w-full text-left rtl:text-right p-2 rounded-lg hover:bg-slate-100 flex items-center justify-between"
                          >
                            <span className="font-semibold">{lang === 'ar' ? product.title_ar : product.title_en}</span>
                            <span className="text-sm text-slate-600">
                              {currentPrice.toFixed(2)} {formatCurrency(product.currency)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">{t('Subtotal', 'المجموع الفرعي')}:</span>
              <span className="font-bold text-lg">
                {isEditing
                  ? calculateTotals(editingItems).subtotal.toFixed(2)
                  : localOrder.subtotal.toFixed(2)} {formatCurrency(localOrder.currency)}
              </span>
            </div>
            {localOrder.orderType === 'delivery' && localOrder.deliveryFee !== undefined && localOrder.deliveryFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-300">{t('Delivery Fee', 'رسوم التوصيل')}:</span>
                <span className="font-bold text-lg">
                  {localOrder.deliveryFee.toFixed(2)} {formatCurrency(localOrder.currency)}
                </span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xl">{t('Total', 'المجموع')}:</span>
                <span className="font-black text-3xl">
                  {isEditing
                    ? calculateTotals(editingItems).totalAmount.toFixed(2)
                    : localOrder.totalAmount.toFixed(2)} {formatCurrency(localOrder.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Status Timeline */}
        <div className="space-y-4 my-8">
          <h3 className="font-black text-lg text-slate-900 mb-4">{t('Update Order Status', 'تحديث حالة الطلب')}</h3>

          {/* Activity Timeline (only visible when there are timestamps to show) */}
          {/* Activity Timeline: full timestamp for every step */}
          <div className="mb-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-4">{t('Activity Timeline', 'سجل النشاطات')}</h4>
            {(() => {
              const fmt = (iso: string) =>
                new Date(iso).toLocaleString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              return (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 rtl:before:ml-0 rtl:before:mr-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {/* 1. Order received — always shown */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                      <p className="text-xs font-bold text-slate-800">{t('Order received', 'تم استلام الطلب')}</p>
                      <p className="text-xs text-slate-500 mt-1">{fmt(localOrder.createdAt)}</p>
                    </div>
                  </div>

                  {/* 2. Order ready (optional) */}
                  {localOrder.preparedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Order is ready', 'الطلب جاهز')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(localOrder.preparedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 3. Driver on the way to business */}
                  {localOrder.driverAcceptedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Driver on the way to business', 'السائق في الطريق إلى المتجر')}</p>
                        {localOrder.assignedDriver && (
                          <p className="text-xs font-medium text-slate-700">{localOrder.assignedDriver.name} ({localOrder.assignedDriver.phoneNumber})</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{fmt(localOrder.driverAcceptedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 4. Order picked up / on the way to client */}
                  {localOrder.driverPickedUpAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Order picked up — on the way to client', 'تم استلام الطلب — في الطريق إلى العميل')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(localOrder.driverPickedUpAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 5. Order delivered / completed */}
                  {localOrder.completedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Order delivered / completed', 'تم التوصيل / مكتمل')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(localOrder.completedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Order cancelled (by business/customer) */}
                  {localOrder.cancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-red-300 bg-red-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-red-50 shadow-sm border border-red-100 flex flex-col">
                        <p className="text-xs font-bold text-red-800">{t('Order cancelled', 'تم إلغاء الطلب')}</p>
                        <p className="text-xs text-red-600 mt-1">{fmt(localOrder.cancelledAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Driver cancelled delivery */}
                  {localOrder.driverCancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-amber-300 bg-amber-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-amber-50 shadow-sm border border-amber-100 flex flex-col">
                        <p className="text-xs font-bold text-amber-800">{t('Driver cancelled delivery', 'السائق ألغى التوصيل')}</p>
                        <p className="text-xs text-amber-600 mt-1">{fmt(localOrder.driverCancelledAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {(() => {
            const currentStatus = localOrder.status
            const isDelivery = localOrder.orderType === 'delivery'
            const isDineIn = localOrder.orderType === 'dine-in'
            const canChangeStatus = !['completed', 'served', 'cancelled', 'refunded'].includes(currentStatus)
            
            // StepButton: active = large primary, completed = strikethrough gray, upcoming = small+faded but CLICKABLE to allow bypass
            const StepButton = ({ 
              isActive, 
              isCompleted, 
              onClick, 
              icon: Icon, 
              labelEn, 
              labelAr, 
              colorClass,
              children 
            }: {
              isActive: boolean
              isCompleted: boolean
              onClick?: () => void
              icon: any
              labelEn: string
              labelAr: string
              colorClass: string
              children?: React.ReactNode
            }) => {
              if (isCompleted) {
                if (canChangeStatus && onClick) {
                  return (
                    <button
                      type="button"
                      onClick={onClick}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-colors text-left rtl:text-right text-slate-500 group"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-slate-500 transition-colors" />
                        <span className="font-bold line-through group-hover:no-underline transition-all">{t(labelEn, labelAr)}</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 bg-slate-200 rounded-lg text-slate-600 uppercase tracking-wider">{t('Revert', 'تراجع')}</span>
                    </button>
                  )
                }
                return (
                  <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 opacity-60">
                    <CheckCircle2 className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-slate-500 line-through">{t(labelEn, labelAr)}</span>
                  </div>
                )
              }
              
              if (isActive) {
                return (
                  <div className={`p-1 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 ${colorClass.replace('bg-', 'border-').replace(/-([\d]+)$/, '-300')}`}>
                    <Button
                      onClick={onClick}
                      className={`w-full ${colorClass} hover:opacity-90 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 h-16 shadow-sm`}
                    >
                      <Icon className="w-6 h-6" />
                      {t(labelEn, labelAr)}
                    </Button>
                    {children && <div className="p-3">{children}</div>}
                  </div>
                )
              }
              
              // Upcoming — clickable with reduced opacity so tenant can bypass any step
              return (
                <Button
                  onClick={onClick}
                  className={`w-full ${colorClass} opacity-40 hover:opacity-65 text-white rounded-xl font-bold flex items-center justify-center gap-2 h-10 transition-opacity`}
                >
                  <Icon className="w-4 h-4" />
                  {t(labelEn, labelAr)}
                </Button>
              )
            }

            if (isDelivery) {
              const s0Active = currentStatus === 'new' && !!localOrder.scheduledFor
              const s0Done = ['acknowledged', 'preparing', 'waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)

              const s1Active = (currentStatus === 'new' && !localOrder.scheduledFor) || currentStatus === 'acknowledged'
              const s1Done = ['preparing', 'waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)
              
              // "Order is Ready" is optional — tenant can skip directly to Request Delivery
              const s2Active = currentStatus === 'preparing'
              const s2Done = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)

              // Step 3 (Request/Assign): active when preparing (bypass) OR waiting_for_delivery without driver
              // Grayed when driver manually assigned (assignedDriver set while still waiting_for_delivery)
              const hasAssignedDriver = !!localOrder.assignedDriver
              const step3Done = ['driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)
                || (currentStatus === 'waiting_for_delivery' && hasAssignedDriver)
              const step3Active = (currentStatus === 'waiting_for_delivery' && !hasAssignedDriver)
                || currentStatus === 'preparing'

              // Step 4 (Picked up): active when driver_on_the_way OR when driver assigned but status still waiting
              const step4Active = currentStatus === 'driver_on_the_way'
                || (currentStatus === 'waiting_for_delivery' && hasAssignedDriver)
              const step4Done = ['out-for-delivery', 'completed'].includes(currentStatus)

              const step5Active = currentStatus === 'out-for-delivery'
              const step5Done = currentStatus === 'completed'

              return (
                <div className="flex flex-col gap-3">
                  {!!localOrder.scheduledFor && (
                    s0Active ? (
                      <div className={`p-4 rounded-3xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 ${['completed', 'cancelled', 'refunded'].includes(currentStatus) ? 'opacity-30' : ''}`}>
                        <h4 className="font-bold text-purple-900 mb-2 flex justify-between items-center">
                          {t('Scheduled Order', 'طلب مجدول')}
                          <Button variant="default" size="sm" onClick={() => {
                            setNewScheduleDate(localOrder.scheduledFor ? new Date(new Date(localOrder.scheduledFor).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '')
                            setIsEditingSchedule(!isEditingSchedule)
                          }} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm h-9 px-3 rounded-xl font-bold flex items-center gap-2">
                            {isEditingSchedule ? t('Cancel', 'إلغاء') : (
                              <>
                                <Edit2 className="w-4 h-4" />
                                {t('Edit Time', 'تعديل الوقت')}
                              </>
                            )}
                          </Button>
                        </h4>
                        
                        {isEditingSchedule ? (
                          <div className="mb-4 p-3 bg-white/60 rounded-2xl border border-purple-200">
                            <label className="text-sm font-medium text-purple-800 block mb-2">
                              {t('New Date & Time:', 'تاريخ ووقت جديد:')}
                            </label>
                            <input
                              type="datetime-local"
                              value={newScheduleDate}
                              onChange={(e) => setNewScheduleDate(e.target.value)}
                              className="w-full p-2 rounded-xl border-purple-200 bg-white text-purple-900 mb-3"
                            />
                            <Button
                              onClick={() => {
                                if (newScheduleDate) {
                                  const notifyAt = new Date(new Date(newScheduleDate).getTime() - reminderMinutes * 60000).toISOString()
                                  onStatusUpdate(localOrder._id, 'acknowledged', notifyAt, new Date(newScheduleDate).toISOString())
                                  setIsEditingSchedule(false)
                                }
                              }}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm"
                            >
                              <Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                              {t('Save Changes', 'حفظ التغييرات')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-4">
                              <label className="text-sm font-medium text-purple-800 block mb-1">
                                {t('Remind me to start preparing:', 'ذكرني ببدء التحضير:')}
                              </label>
                              <select 
                                value={reminderMinutes} 
                                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                                className="w-full p-2 rounded-xl border-purple-200 bg-white text-purple-900"
                              >
                                <option value={15}>{t('15 mins before', 'قبل 15 دقيقة')}</option>
                                <option value={30}>{t('30 mins before', 'قبل 30 دقيقة')}</option>
                                <option value={60}>{t('1 hour before', 'قبل ساعة')}</option>
                                <option value={120}>{t('2 hours before', 'قبل ساعتين')}</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                onClick={() => {
                                  const notifyAt = new Date(new Date(localOrder.scheduledFor!).getTime() - reminderMinutes * 60000).toISOString()
                                  onStatusUpdate(localOrder._id, 'acknowledged', notifyAt)
                                }}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold h-12 shadow-sm"
                              >
                                {t('Keep in Scheduled Orders', 'حفظ في الطلبات المجدولة')}
                              </Button>
                              <Button 
                                onClick={() => onStatusUpdate(localOrder._id, 'preparing')}
                                variant="outline"
                                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl font-bold h-12"
                              >
                                {t('Start Preparing Now', 'البدء في التحضير الآن')}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <StepButton isActive={false} isCompleted={s0Done} onClick={currentStatus === 'preparing' ? () => onStatusUpdate(localOrder._id, 'acknowledged') : undefined} icon={CheckCircle2} labelEn="Scheduled Order Acknowledged" labelAr="تم استلام الطلب المجدول" colorClass={`bg-purple-500 ${['completed', 'cancelled', 'refunded'].includes(currentStatus) ? 'opacity-30' : ''}`} />
                    )
                  )}
                  <StepButton isActive={s1Active} isCompleted={s1Done} onClick={() => onStatusUpdate(localOrder._id, 'preparing')} icon={ChefHat} labelEn="Start Preparing" labelAr="بدء التحضير" colorClass="bg-orange-500" />
                  
                  {/* Order is Ready — optional step, shown but bypassable */}
                  <StepButton isActive={s2Active} isCompleted={s2Done} onClick={() => onStatusUpdate(localOrder._id, 'waiting_for_delivery')} icon={Package} labelEn="Order is Ready (optional)" labelAr="الطلب جاهز (اختياري)" colorClass="bg-amber-500" />
                  
                  {/* Step 3: Request / Assign Delivery */}
                  {step3Done ? (
                    <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 opacity-80">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-slate-500 line-through">{t('Driver Assigned', 'تم تعيين السائق')}</span>
                      </div>
                      {localOrder.assignedDriver && (
                        <div className="ml-8 rtl:mr-8 rtl:ml-0 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                          <div>
                            <p className="font-bold text-slate-800">{localOrder.assignedDriver.name}</p>
                            <p className="text-sm text-slate-500">{localOrder.assignedDriver.phoneNumber}</p>
                          </div>
                          <div className="flex gap-2">
                            {tenantSlug && (
                              <Button onClick={unassignDriver} disabled={unassigningDriver || !canChangeStatus} variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50 px-2 h-8">
                                {unassigningDriver ? '...' : t('Unassign', 'إلغاء التعيين')}
                              </Button>
                            )}
                            <Button onClick={() => sendWhatsAppToDriver(localOrder.assignedDriver!)} variant="ghost" size="sm" className="text-green-600 hover:bg-green-50 px-2 h-8">
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : step3Active ? (
                    <div className="p-1 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-blue-300">
                      <div className="flex gap-2 mb-2 px-1 pt-1">
                        <Button
                          onClick={requestDelivery}
                          disabled={requestingDriver}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg h-16 shadow-sm"
                        >
                          <Truck className="w-6 h-6 mr-2 rtl:ml-2 rtl:mr-0" />
                          {requestingDriver ? t('Requesting...', 'جارٍ الطلب...') : t('Request Delivery', 'طلب توصيل')}
                        </Button>
                        <Button
                          onClick={handleOrderACaptain}
                          variant="outline"
                          className="w-16 h-16 rounded-2xl border-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-50 shrink-0"
                        >
                          <User className="w-6 h-6" />
                        </Button>
                      </div>
                      
                      {tenantSlug && !loadingBusinessLocation && (!businessLocation?.country?.trim() || !businessLocation?.city?.trim()) && (
                        <div className="mx-2 mb-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-900 border border-amber-200">
                          {t('Set your business location in settings to request drivers.', 'حدّد موقع عملك في الإعدادات لطلب السائقين.')}
                        </div>
                      )}

                      {showDriverSelector && (
                        <div className="mx-2 mb-2 p-4 bg-white rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-bold text-slate-800">{t('Available Drivers', 'السائقون المتاحون')}</p>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                              <input type="checkbox" checked={showOfflineDrivers} onChange={(e) => setShowOfflineDrivers(e.target.checked)} className="rounded border-slate-300" />
                              {t('Show offline', 'إظهار غير المتصلين')}
                            </label>
                          </div>
                          
                          {loadingDrivers ? (
                            <p className="text-center text-slate-500 py-4 text-sm">{t('Loading...', 'جارٍ التحميل...')}</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {drivers.filter(d => showOfflineDrivers || d.isOnline).map((driver) => {
                                const canServeArea = !localOrder.deliveryArea || !driver.deliveryAreas || driver.deliveryAreas.length === 0 || driver.deliveryAreas.some(area => area._id === localOrder.deliveryArea?._id)
                                return (
                                  <div key={driver._id} className={`flex items-center justify-between p-3 rounded-xl border ${canServeArea ? 'border-slate-200' : 'border-orange-200 bg-orange-50'}`}>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm">{driver.name}</p>
                                        {driver.isOnline ? (
                                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        ) : (
                                          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500">{driver.phoneNumber}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button onClick={() => sendWhatsAppToDriver(driver)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600">
                                        <MessageCircle className="w-4 h-4" />
                                      </Button>
                                      <Button onClick={() => assignDriver(driver._id)} disabled={assigningDriverId !== null} size="sm" className="h-8 px-3 rounded-lg text-xs font-bold">
                                        {t('Assign', 'تعيين')}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                              {drivers.filter(d => showOfflineDrivers || d.isOnline).length === 0 && (
                                <p className="text-center text-slate-500 py-4 text-sm">{t('No drivers found.', 'لم يتم العثور على سائقين.')}</p>
                              )}
                            </div>
                          )}
                          <Button onClick={() => setShowDriverSelector(false)} variant="ghost" size="sm" className="w-full mt-2 text-slate-500 hover:text-slate-700">
                            {t('Close', 'إغلاق')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <StepButton isActive={false} isCompleted={false} onClick={() => onStatusUpdate(localOrder._id, 'waiting_for_delivery')} icon={Truck} labelEn="Request Delivery" labelAr="طلب توصيل" colorClass="bg-blue-600" />
                  )}

                  <StepButton isActive={step4Active} isCompleted={step4Done} onClick={() => onStatusUpdate(localOrder._id, 'out-for-delivery')} icon={Package} labelEn="Order Picked up" labelAr="تم استلام الطلب" colorClass="bg-purple-500" />
                  
                  <StepButton isActive={step5Active} isCompleted={step5Done} onClick={() => onStatusUpdate(localOrder._id, 'completed')} icon={CheckCircle2} labelEn="Completed" labelAr="مكتمل" colorClass="bg-green-600" />

                </div>
              )
            }

            // Dine-in / Receive in person
            const s0Active = currentStatus === 'new' && !!localOrder.scheduledFor
            const s0Done = ['acknowledged', 'preparing', 'served', 'completed'].includes(currentStatus)

            const s1Active = (currentStatus === 'new' && !localOrder.scheduledFor) || currentStatus === 'acknowledged'
            const s1Done = ['preparing', 'served', 'completed'].includes(currentStatus)
            
            const s2Active = currentStatus === 'preparing'
            const s2Done = ['served', 'completed'].includes(currentStatus)

              return (
                <div className="flex flex-col gap-3">
                  {!!localOrder.scheduledFor && (
                    s0Active ? (
                      <div className={`p-4 rounded-3xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 ${['completed', 'cancelled', 'refunded'].includes(currentStatus) ? 'opacity-30' : ''}`}>
                        <h4 className="font-bold text-purple-900 mb-2 flex justify-between items-center">
                          {t('Scheduled Order', 'طلب مجدول')}
                          <Button variant="default" size="sm" onClick={() => {
                            setNewScheduleDate(localOrder.scheduledFor ? new Date(new Date(localOrder.scheduledFor).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '')
                            setIsEditingSchedule(!isEditingSchedule)
                          }} className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm h-9 px-3 rounded-xl font-bold flex items-center gap-2">
                            {isEditingSchedule ? t('Cancel', 'إلغاء') : (
                              <>
                                <Edit2 className="w-4 h-4" />
                                {t('Edit Time', 'تعديل الوقت')}
                              </>
                            )}
                          </Button>
                        </h4>
                        
                        {isEditingSchedule ? (
                          <div className="mb-4 p-3 bg-white/60 rounded-2xl border border-purple-200">
                            <label className="text-sm font-medium text-purple-800 block mb-2">
                              {t('New Date & Time:', 'تاريخ ووقت جديد:')}
                            </label>
                            <input
                              type="datetime-local"
                              value={newScheduleDate}
                              onChange={(e) => setNewScheduleDate(e.target.value)}
                              className="w-full p-2 rounded-xl border-purple-200 bg-white text-purple-900 mb-3"
                            />
                            <Button
                              onClick={() => {
                                if (newScheduleDate) {
                                  const notifyAt = new Date(new Date(newScheduleDate).getTime() - reminderMinutes * 60000).toISOString()
                                  onStatusUpdate(localOrder._id, 'acknowledged', notifyAt, new Date(newScheduleDate).toISOString())
                                  setIsEditingSchedule(false)
                                }
                              }}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm"
                            >
                              <Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                              {t('Save Changes', 'حفظ التغييرات')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-4">
                              <label className="text-sm font-medium text-purple-800 block mb-1">
                                {t('Remind me to start preparing:', 'ذكرني ببدء التحضير:')}
                              </label>
                              <select 
                                value={reminderMinutes} 
                                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                                className="w-full p-2 rounded-xl border-purple-200 bg-white text-purple-900"
                              >
                                <option value={15}>{t('15 mins before', 'قبل 15 دقيقة')}</option>
                                <option value={30}>{t('30 mins before', 'قبل 30 دقيقة')}</option>
                                <option value={60}>{t('1 hour before', 'قبل ساعة')}</option>
                                <option value={120}>{t('2 hours before', 'قبل ساعتين')}</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                onClick={() => {
                                  const notifyAt = new Date(new Date(localOrder.scheduledFor!).getTime() - reminderMinutes * 60000).toISOString()
                                  onStatusUpdate(localOrder._id, 'acknowledged', notifyAt)
                                }}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold h-12 shadow-sm"
                              >
                                {t('Keep in Scheduled Orders', 'حفظ في الطلبات المجدولة')}
                              </Button>
                              <Button 
                                onClick={() => onStatusUpdate(localOrder._id, 'preparing')}
                                variant="outline"
                                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl font-bold h-12"
                              >
                                {t('Start Preparing Now', 'البدء في التحضير الآن')}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <StepButton isActive={false} isCompleted={s0Done} onClick={currentStatus === 'preparing' ? () => onStatusUpdate(localOrder._id, 'acknowledged') : undefined} icon={CheckCircle2} labelEn="Scheduled Order Acknowledged" labelAr="تم استلام الطلب المجدول" colorClass={`bg-purple-500 ${['completed', 'cancelled', 'refunded'].includes(currentStatus) ? 'opacity-30' : ''}`} />
                    )
                  )}
                  <StepButton isActive={s1Active} isCompleted={s1Done} onClick={() => onStatusUpdate(localOrder._id, 'preparing')} icon={ChefHat} labelEn="Start Preparing" labelAr="بدء التحضير" colorClass="bg-orange-500" />
                
                {isDineIn && (
                  <StepButton isActive={s2Active} isCompleted={s2Done} onClick={() => onStatusUpdate(localOrder._id, 'served')} icon={UtensilsCrossed} labelEn="Mark as Served" labelAr="تم التقديم للعميل" colorClass="bg-emerald-600" />
                )}

                <StepButton isActive={isDineIn ? currentStatus === 'served' : s2Active} isCompleted={currentStatus === 'completed'} onClick={() => onStatusUpdate(localOrder._id, 'completed')} icon={CheckCircle2} labelEn="Completed" labelAr="مكتمل" colorClass="bg-green-600" />
              </div>
            )
          })()}

          {/* Cancel and Refund */}
          {canChangeStatus && (
            <div className="flex flex-wrap gap-3 pt-4 mt-6 border-t border-slate-200">
              <Button
                onClick={() => setConfirmAction('cancelled')}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl font-bold h-11"
              >
                <XCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                onClick={() => setConfirmAction('refunded')}
                variant="outline"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 rounded-xl font-bold h-11"
              >
                <RotateCcw className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Refund', 'استرداد')}
              </Button>
            </div>
          )}

        {/* Report form modal */}
          {reportTarget && tenantSlug && (
            <ReportFormModal
              open={true}
              onClose={() => setReportTarget(null)}
              reporterType="business"
              reportedType={reportTarget}
              orderId={localOrder._id}
              slug={tenantSlug}
              onSuccess={() => setReportTarget(null)}
            />
          )}

          {/* Confirmation dialog for Cancel / Refund */}
          {confirmAction !== null && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmAction(null)}>
              <div
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-slate-900"
                onClick={(e) => e.stopPropagation()}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                <p className="font-bold text-lg mb-4">
                  {confirmAction === 'cancelled'
                    ? t('Are you sure you want to cancel this order?', 'هل أنت متأكد من إلغاء هذا الطلب؟')
                    : t('Are you sure you want to mark this order as refunded?', 'هل أنت متأكد من استرداد هذا الطلب؟')}
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => setConfirmAction(null)}>
                    {t('Back', 'رجوع')}
                  </Button>
                  <Button
                    className={`rounded-xl ${confirmAction === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    onClick={() => handleConfirmStatus(confirmAction)}
                  >
                    {t('Yes, confirm', 'نعم، تأكيد')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}