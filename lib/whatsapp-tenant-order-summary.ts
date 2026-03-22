/**
 * Formats the tenant "new order" WhatsApp template body (variable {{2}}).
 *
 * Meta Cloud API rejects newlines, tabs, and 4+ consecutive spaces in template
 * body parameters ("Param text cannot have new-line/tab characters…"). The
 * sanitiser in send-tenant-new-order-whatsapp.ts enforces that, so we cannot
 * produce true multi-line messages from code alone — only denser one-line text
 * with strong visual section breaks (⸻ · • numbered items). For real
 * paragraphs, Meta requires a new approved template (e.g. multiple body
 * variables or fixed line breaks in the template text).
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
    return kept.slice(0, 3).join(' · ')
  }
  return parts.slice(0, 2).join(' · ') || t
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
  if (orderType === 'delivery') return 'توصيل 🚚'
  if (orderType === 'dine-in') return 'محلي 🪑'
  return 'استلام 🏃'
}

/** LTR embed so phone numbers and URLs are readable inside Arabic RTL bubbles. */
function ltrEmbed(s: string): string {
  const t = s.trim()
  if (!t) return '—'
  return `\u200E${t}\u200E`
}

const SECTION = ' ⸻ '

/**
 * One line per item when multiple (still one string for Meta); bullets for scanability.
 */
function formatItemsList(items: TenantOrderWhatsAppItem[] | null | undefined, currency: string): string {
  if (!items?.length) return 'لا توجد منتجات'
  const cur = currency || 'ILS'
  if (items.length === 1) {
    const i = items[0]!
    const name = i.productNameAr || i.productName || 'منتج'
    return `${i.quantity}× ${name} (${i.total} ${cur})`
  }
  return items
    .map((i, idx) => {
      const name = i.productNameAr || i.productName || 'منتج'
      return `${idx + 1}) ${i.quantity}× ${name} (${i.total} ${cur})`
    })
    .join('  •  ')
}

/**
 * Single string for Meta template body variable — no newlines (API rejects them).
 * Uses ⸻ (section), · (minor), and numbered lines for multi-item orders.
 */
export function formatTenantNewOrderWhatsAppSummary(data: TenantOrderWhatsAppInput): string {
  const cur = (data.currency?.trim() || 'ILS')
  const total = data.totalAmount ?? 0
  const orderTypeLabel = orderTypeLabelAr(data.orderType)

  // ── Items block ──────────────────────────────────────────────────────────
  const itemsBlock = formatItemsList(data.items ?? null, cur)

  // ── Customer block ────────────────────────────────────────────────────────
  const customerName = data.customerName?.trim() || 'غير معروف'
  const customerPhone = data.customerPhone?.trim() || '—'

  // ── Delivery block (only for delivery orders with an address) ─────────────
  let deliveryBlock = ''
  const addrRaw = data.deliveryAddress?.trim()
  if (addrRaw && data.orderType === 'delivery') {
    const shortLabel = shortenDeliveryAddressForDisplay(addrRaw)
    const { googleMaps, waze } = buildNavigationUrls({
      address: addrRaw,
      lat: data.deliveryLat,
      lng: data.deliveryLng,
    })
    deliveryBlock =
      `${SECTION}📍 ${shortLabel}` +
      `${SECTION}🗺 Google Maps: ${ltrEmbed(googleMaps)}` +
      `${SECTION}🚙 Waze: ${ltrEmbed(waze)}`
  }

  return (
    `📦 الطلبات: ${itemsBlock}` +
    `${SECTION}💰 الإجمالي: ${total} ${cur}` +
    `${SECTION}👤 ${customerName}` +
    `${SECTION}📞 ${ltrEmbed(customerPhone)}` +
    `${SECTION}${orderTypeLabel}` +
    deliveryBlock
  )
}
