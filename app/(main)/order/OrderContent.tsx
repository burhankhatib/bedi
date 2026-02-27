'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Printer, Download, Send, Pencil, Plus, Minus, Trash2, PlusCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { client } from '@/sanity/lib/client'

interface OrderItem {
  quantity: number
  title?: string
  productName?: string
  productId?: string
  price: number
  total: number
  currency: string
  notes?: string
  addOns?: string
}

interface OrderData {
  items: OrderItem[]
  total: number
  currency: string
  timestamp: string
  customerName?: string
  tableNumber?: string
}

interface MenuProduct {
  _id: string
  title_en: string
  title_ar: string
  price: number
  specialPrice?: number
  specialPriceExpires?: string
  currency: string
}

interface MenuCategory {
  _id: string
  title_en: string
  title_ar: string
  products?: MenuProduct[]
}

export default function OrderContent() {
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [isSendingToManagement, setIsSendingToManagement] = useState(false)
  const [sendToManagementSuccess, setSendToManagementSuccess] = useState<string | null>(null)
  const [sendToManagementError, setSendToManagementError] = useState<string | null>(null)
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  useEffect(() => {
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const decoded = decodeURIComponent(dataParam)
        const order = JSON.parse(decoded) as OrderData
        setOrderData(order)
      } catch (error) {
        console.error('Failed to parse order data:', error)
      }
    }

  }, [searchParams])

  useEffect(() => {
    if (!isEditingItems) return
    fetch('/api/menu')
      .then((res) => res.ok ? res.json() : null)
      .then((data: { categories?: MenuCategory[] } | null) => {
        if (data?.categories) setMenuCategories(data.categories)
      })
      .catch(() => {})
  }, [isEditingItems])

  const handlePrintClick = () => {
    setTimeout(() => window.print(), 100)
  }

  if (!orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-4">{t('Order Not Found', 'الطلب غير موجود')}</h1>
          <p className="text-slate-500">{t('Invalid order data', 'بيانات الطلب غير صحيحة')}</p>
        </div>
      </div>
    )
  }

  // Always display date/time in English/Latin format
  const orderDate = new Date(orderData.timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleSendToOrderManagement = async () => {
    if (!orderData || !orderData.customerName || !orderData.tableNumber) {
      setSendToManagementError(t('Customer name and table number are required', 'الاسم ورقم الطاولة مطلوبان'))
      return
    }
    setIsSendingToManagement(true)
    setSendToManagementError(null)
    setSendToManagementSuccess(null)
    try {
      const items = orderData.items.map((item) => ({
        productId: item.productId || undefined,
        productName: item.productName || item.title || '',
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        notes: item.notes || '',
        addOns: item.addOns || '',
      }))
      const subtotal = orderData.items.reduce((sum, i) => sum + i.total, 0)
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'dine-in',
          customerName: orderData.customerName,
          tableNumber: orderData.tableNumber,
          items,
          subtotal,
          totalAmount: orderData.total,
          currency: orderData.currency || 'ILS',
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create order')
      }
      const result = await response.json()
      setSendToManagementSuccess(result.orderNumber || 'OK')
    } catch (e) {
      setSendToManagementError(e instanceof Error ? e.message : t('Failed to send order', 'فشل إرسال الطلب'))
    } finally {
      setIsSendingToManagement(false)
    }
  }

  const updateItemQuantity = (index: number, delta: number) => {
    if (!orderData) return
    const items = orderData.items.map((item, i) => {
      if (i !== index) return item
      const newQty = Math.max(0, item.quantity + delta)
      if (newQty === 0) return null
      const total = item.price * newQty
      return { ...item, quantity: newQty, total }
    }).filter(Boolean) as OrderItem[]
    const total = items.reduce((sum, i) => sum + i.total, 0)
    setOrderData({ ...orderData, items, total })
  }

  const setItemQuantity = (index: number, quantity: number) => {
    if (!orderData) return
    const qty = Math.max(1, Math.floor(Number(quantity)) || 1)
    const items = orderData.items.map((item, i) => {
      if (i !== index) return item
      const total = item.price * qty
      return { ...item, quantity: qty, total }
    })
    const total = items.reduce((sum, i) => sum + i.total, 0)
    setOrderData({ ...orderData, items, total })
  }

  const setItemNotes = (index: number, notes: string) => {
    if (!orderData) return
    const items = orderData.items.map((item, i) =>
      i === index ? { ...item, notes } : item
    )
    setOrderData({ ...orderData, items })
  }

  const removeItem = (index: number) => {
    if (!orderData) return
    const items = orderData.items.filter((_, i) => i !== index)
    const total = items.length ? items.reduce((sum, i) => sum + i.total, 0) : 0
    setOrderData({ ...orderData, items, total })
  }

  const addItemToOrder = (product: MenuProduct) => {
    if (!orderData) return
    const hasSpecial = product.specialPrice != null && product.specialPriceExpires &&
      new Date(product.specialPriceExpires) > new Date()
    const price = hasSpecial ? product.specialPrice! : product.price
    const name = lang === 'ar' ? product.title_ar : product.title_en
    const newItem: OrderItem = {
      productId: product._id,
      productName: name,
      quantity: 1,
      price,
      total: price,
      currency: product.currency || orderData.currency || 'ILS',
      notes: '',
      addOns: '',
    }
    const items = [...orderData.items, newItem]
    const total = items.reduce((sum, i) => sum + i.total, 0)
    setOrderData({ ...orderData, items, total })
    setSelectedProductId('')
  }

  const handleDownload = () => {
    // Create HTML content for download
    const htmlContent = `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Receipt - ${orderDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: white;
      padding: 2rem;
      color: #1e293b;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    .header {
      background: #000;
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5rem;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .header p {
      color: #cbd5e1;
      font-size: 0.9rem;
    }
    .content {
      padding: 2rem;
    }
    .item {
      border-bottom: 1px solid #e2e8f0;
      padding: 1.5rem 0;
    }
    .item:last-child {
      border-bottom: none;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 0.5rem;
    }
    .item-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }
    .item-quantity {
      font-weight: 900;
      color: #94a3b8;
      font-size: 1.1rem;
    }
    .item-name {
      font-weight: 900;
      font-size: 1.5rem;
    }
    .item-price {
      text-align: right;
    }
    .item-price-unit {
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .item-price-total {
      font-weight: 900;
      font-size: 1.5rem;
    }
    .item-notes {
      margin-top: 0.75rem;
      margin-left: 2rem;
      padding: 0.75rem;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 0 0.5rem 0.5rem 0;
    }
    .item-notes p {
      font-size: 0.875rem;
      font-weight: 600;
      color: #92400e;
    }
    .total {
      border-top: 4px solid #000;
      padding-top: 1.5rem;
      margin-top: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 1.5rem;
      font-weight: 900;
      text-transform: uppercase;
    }
    .total-amount {
      font-size: 2rem;
      font-weight: 900;
    }
    .footer {
      background: #f8fafc;
      padding: 2rem;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      color: #64748b;
      font-size: 0.875rem;
    }
    @media print {
      body { padding: 0; }
      .header { padding: 2rem 1.5rem; }
      .content { padding: 1.5rem; }
      .footer { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Receipt</h1>
      ${orderData.customerName || orderData.tableNumber ? `
        <div style="margin-top: 1rem;">
          ${orderData.customerName ? `<p style="color: #cbd5e1; font-size: 1rem; margin-bottom: 0.5rem;"><strong>Customer:</strong> ${orderData.customerName}</p>` : ''}
          ${orderData.tableNumber ? `<p style="color: #cbd5e1; font-size: 1rem;"><strong>Table:</strong> ${orderData.tableNumber}</p>` : ''}
        </div>
      ` : ''}
      <p>${orderDate}</p>
    </div>
    <div class="content">
      ${orderData.items.map((item) => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">
              <span class="item-quantity">${item.quantity}x</span>
              <h3 class="item-name">${item.title || item.productName || ''}</h3>
            </div>
            <div class="item-price">
              <p class="item-price-unit">${item.price.toFixed(2)} ${item.currency === 'ILS' ? '₪' : item.currency} × ${item.quantity}</p>
              <p class="item-price-total">${item.total.toFixed(2)} ${item.currency === 'ILS' ? '₪' : item.currency}</p>
            </div>
          </div>
          ${item.notes ? `
            <div class="item-notes">
              <p>📝 ${item.notes}</p>
            </div>
          ` : ''}
        </div>
      `).join('')}
      <div class="total">
        <span class="total-label">Total:</span>
        <span class="total-amount">${orderData.total.toFixed(2)} ${orderData.currency === 'ILS' ? '₪' : orderData.currency}</span>
      </div>
    </div>
    <div class="footer">
      <p>Thank you for your order!</p>
    </div>
  </div>
</body>
</html>
    `.trim()

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `order-${orderData.timestamp.split('T')[0]}-${Date.now()}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-white p-6 md:p-12 print:p-4">
      {/* Action Buttons - Hidden when printing */}
      <div className="mb-6 print:hidden flex flex-col gap-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-3xl font-black">{t('Order Details', 'تفاصيل الطلب')}</h1>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setIsEditingItems(!isEditingItems)}
              variant={isEditingItems ? 'default' : 'outline'}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              {isEditingItems ? t('Done Editing', 'إنهاء التعديل') : t('Edit Items', 'تعديل العناصر')}
            </Button>
            <Button onClick={handleSendToOrderManagement} disabled={isSendingToManagement || orderData.items.length === 0} className="gap-2 bg-green-600 text-white hover:bg-green-700">
              <Send className="w-4 h-4" />
              {isSendingToManagement ? t('Sending...', 'جارٍ الإرسال...') : t('Send to Order Management', 'إرسال لنظام الطلبات')}
            </Button>
            <Button onClick={handleDownload} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              {t('Save to Device', 'حفظ على الجهاز')}
            </Button>
            <Button onClick={handlePrintClick} className="gap-2">
              <Printer className="w-4 h-4" />
              {t('Print', 'طباعة')}
            </Button>
          </div>
        </div>
        {sendToManagementSuccess && (
          <p className="text-green-600 font-semibold">
            {t('Order', 'الطلب')} #{sendToManagementSuccess} {t('sent to kitchen successfully.', 'أُرسل إلى المطبخ بنجاح.')}
          </p>
        )}
        {sendToManagementError && (
          <p className="text-red-600 font-semibold">{sendToManagementError}</p>
        )}
      </div>

      <div className="max-w-4xl mx-auto bg-white print:shadow-none shadow-xl rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-black text-white p-8 md:p-12 print:p-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tight">
            {t('Order Receipt', 'إيصال الطلب')}
          </h2>
          {(orderData.customerName || orderData.tableNumber) && (
            <div className="mt-4 space-y-1">
              {orderData.customerName && (
                <p className="text-slate-200 text-base md:text-lg">
                  <span className="font-semibold">{t('Customer', 'العميل')}:</span> {orderData.customerName}
                </p>
              )}
              {orderData.tableNumber && (
                <p className="text-slate-200 text-base md:text-lg">
                  <span className="font-semibold">{t('Table', 'الطاولة')}:</span> {orderData.tableNumber}
                </p>
              )}
            </div>
          )}
          <p className="text-slate-300 text-sm md:text-base mt-2">
            {orderDate}
          </p>
        </div>

        {/* Order Items */}
        <div className="p-6 md:p-10 print:p-6">
          <div className="space-y-4 mb-8">
            {orderData.items.length === 0 && !isEditingItems ? (
              <p className="text-slate-500 py-8 text-center font-medium">
                {t('No items in this order.', 'لا توجد عناصر في هذا الطلب.')}
              </p>
            ) : isEditingItems ? (
              <>
                {/* Add item - menu picker */}
                <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">
                    {t('Add item', 'إضافة عنصر')}
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="sr-only">{t('Choose product', 'اختر المنتج')}</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <option value="">{t('Select a product...', 'اختر منتجاً...')}</option>
                        {menuCategories.map((cat) => {
                          const products = cat.products || []
                          if (products.length === 0) return null
                          const catName = lang === 'ar' ? cat.title_ar : cat.title_en
                          return (
                            <optgroup key={cat._id} label={catName}>
                              {products.map((p) => {
                                const name = lang === 'ar' ? p.title_ar : p.title_en
                                const hasSpecial = p.specialPrice != null && p.specialPriceExpires &&
                                  new Date(p.specialPriceExpires) > new Date()
                                const price = hasSpecial ? p.specialPrice! : p.price
                                return (
                                  <option key={p._id} value={p._id}>
                                    {name} — {price.toFixed(2)} {formatCurrency(p.currency)}
                                  </option>
                                )
                              })}
                            </optgroup>
                          )
                        })}
                      </select>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!selectedProductId) return
                        const product = menuCategories
                          .flatMap((c) => c.products || [])
                          .find((p) => p._id === selectedProductId)
                        if (product) addItemToOrder(product)
                      }}
                      disabled={!selectedProductId}
                      className="gap-2 bg-slate-800 hover:bg-slate-900"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {t('Add', 'إضافة')}
                    </Button>
                  </div>
                </div>

                {orderData.items.map((item, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50"
                >
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg md:text-xl mb-2">
                        {item.title || item.productName}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-500">{t('Qty', 'الكمية')}:</span>
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-r-none"
                            onClick={() => updateItemQuantity(index, -1)}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => setItemQuantity(index, e.target.valueAsNumber)}
                            className="w-14 h-9 text-center border-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-l-none"
                            onClick={() => updateItemQuantity(index, 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <span className="text-sm text-slate-600">
                          {item.price.toFixed(2)} {formatCurrency(item.currency)} × {item.quantity} = {item.total.toFixed(2)} {formatCurrency(item.currency)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                          {t('Notes', 'ملاحظات')}
                        </label>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => setItemNotes(index, e.target.value)}
                          placeholder={t('Optional notes...', 'ملاحظات اختيارية...')}
                          className="bg-white"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      onClick={() => removeItem(index)}
                      title={t('Remove item', 'إزالة العنصر')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
              </>
            ) : (
              orderData.items.map((item, index) => (
                <div
                  key={index}
                  className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-black text-lg text-slate-400">
                          {item.quantity}x
                        </span>
                        <h3 className="font-black text-xl md:text-2xl">
                          {item.title || item.productName}
                        </h3>
                      </div>
                      {item.notes && (
                        <div className="mt-2 ml-8 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                          <p className="text-sm font-semibold text-amber-900 flex items-start gap-2">
                            <span>📝</span>
                            <span>{item.notes}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-slate-500 mb-1">
                        {item.price.toFixed(2)} {formatCurrency(item.currency)} × {item.quantity}
                      </p>
                      <p className="font-black text-2xl md:text-3xl">
                        {item.total.toFixed(2)} {formatCurrency(item.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total */}
          <div className="border-t-4 border-black pt-6 mt-8">
            <div className="flex justify-between items-center">
              <span className="text-2xl md:text-3xl font-black uppercase">
                {t('Total', 'المجموع')}:
              </span>
              <span className="text-4xl md:text-5xl font-black">
                {orderData.total.toFixed(2)} {formatCurrency(orderData.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-6 md:p-10 print:p-6 text-center border-t border-slate-200">
          <p className="text-slate-500 text-sm">
            {t('Thank you for your order!', 'شكراً لطلبك!')}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-6 {
            padding: 1.5rem !important;
          }
          .print\\:p-4 {
            padding: 1rem !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>

    </div>
  )
}
