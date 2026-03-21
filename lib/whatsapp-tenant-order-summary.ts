/**
 * Formats the tenant "new order" WhatsApp template body (variable {{2}}).
 * Plain structure and separate lines so WhatsApp linkifies URLs reliably.
 */

/** Strip country / macro-region tails; keep street + locality (e.g. أبو ديس - منطقة ب). */
const ADDRESS_PART_EXCLUDE = [
  /الأراضي الفلسطينية/i,
  /^فلسطين$/i,
  /الضفة الغربية/i,
  /^الضفة$/i,
  /قطاع غزة/i,
  /القدس المحتلة/i,
  /West Bank/i,
  /Palestinian Territories/i,
  /\bPalestine\b/i,
  /\bIsrael\b/i,
  /إسرائيل/,
  /Gaza(\s+Strip)?/i,
]

export function shortenDeliveryAddressForDisplay(raw: string): string {
  const t = raw?.trim()
  if (!t) return ''
  const parts = t.split(/[,،]/).map((p) => p.trim()).filter(Boolean)
  const kept = parts.filter((part) => !ADDRESS_PART_EXCLUDE.some((re) => re.test(part)))
  if (kept.length > 0) {
    return kept.slice(0, 3).join(' - ')
  }
  return parts.slice(0, 2).join(' - ') || t
}

export function buildNavigationUrls(params: { address: string; lat?: number | null; lng?: number | null }) {
  const q = params.address.trim()
  const enc = encodeURIComponent(q)
  const lat = params.lat
  const lng = params.lng
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    }
  }
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${enc}`,
    waze: `https://waze.com/ul?q=${enc}`,
  }
}

export type TenantOrderWhatsAppItem = {
  quantity: number
  productName: string
  productNameAr?: string
  total: number
}

export type TenantOrderWhatsAppInput = {
  currency?: string
  items?: TenantOrderWhatsAppItem[] | null
  totalAmount?: number | null
  customerName?: string | null
  customerPhone?: string | null
  orderType?: string | null
  deliveryAddress?: string | null
  deliveryLat?: number | null
  deliveryLng?: number | null
}

function orderTypeLabelAr(orderType?: string | null): string {
  if (orderType === 'delivery') return 'توصيل'
  if (orderType === 'dine-in') return 'محلي'
  return 'استلام'
}

function formatItemsList(items: TenantOrderWhatsAppItem[] | null | undefined, currency: string): string {
  if (!items?.length) return 'لا توجد منتجات'
  return items
    .map((i) => {
      const nameAr = i.productNameAr
      const nameEn = i.productName
      const title = nameAr || nameEn || 'منتج غير معروف'
      const cur = currency || 'ILS'
      let block = `▪️ *${i.quantity}×* ${title} (💵 *${i.total} ${cur}*)`
      if (nameAr && nameEn && nameAr !== nameEn) {
        block += ` [${nameEn}]`
      }
      return block
    })
    .join(' | ')
}

/**
 * Single string for Meta template body variable — avoid newlines (WhatsApp API rejects them in parameters).
 */
export function formatTenantNewOrderWhatsAppSummary(data: TenantOrderWhatsAppInput): string {
  const cur = data.currency?.trim() || 'ILS'
  const itemsBlock = formatItemsList(data.items ?? null, cur)
  const total = data.totalAmount ?? 0

  let customer = `👤 *الاسم:* ${data.customerName?.trim() || 'غير معروف'}`
  customer += ` - 📞 *الهاتف:* ${data.customerPhone?.trim() || 'غير متوفر'}`
  customer += ` - 🚚 *نوع الطلب:* ${orderTypeLabelAr(data.orderType)}`

  const addrRaw = data.deliveryAddress?.trim()
  if (addrRaw && data.orderType === 'delivery') {
    const shortLabel = shortenDeliveryAddressForDisplay(addrRaw)
    const { googleMaps, waze } = buildNavigationUrls({
      address: addrRaw,
      lat: data.deliveryLat,
      lng: data.deliveryLng,
    })
    customer += ` - 📍 *العنوان:* ${shortLabel}`
    customer += ` - 🗺 *خرائط جوجل:* ${googleMaps}`
    customer += ` - 🚙 *ويز:* ${waze}`
  }

  return (
    `🛒 *المنتجات:* ${itemsBlock} - ` +
    `💰 *الإجمالي:* *${total} ${cur}* - ` +
    `📋 *العميل:* ${customer}`
  )
}
