import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { getShopperFeeByItemCount } from '@/lib/shopper-fee'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { pusherServer } from '@/lib/pusher'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type IncomingItem = {
  _key?: string
  productId?: string
  productName?: string
  quantity?: number
  price?: number
  total?: number
  notes?: string
  addOns?: string
}

/**
 * PATCH: Customer submitted edited cart. Validate token, compute change summary,
 * save items, set customerItemChangeStatus=pending & customerRequestedItemChanges=true, notify driver.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { items?: IncomingItem[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
  }

  const order = await freshClient.fetch<{
    _id: string
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string }
    orderNumber?: string
    orderType?: string
    deliveryFee?: number
    deliveryFeePaidByBusiness?: boolean
    requiresPersonalShopper?: boolean
    items?: Array<{ productName?: string; quantity?: number; productId?: string }>
    subtotal?: number
    totalAmount?: number
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      _id,
      "site": site,
      assignedDriver,
      orderNumber,
      orderType,
      deliveryFee,
      deliveryFeePaidByBusiness,
      requiresPersonalShopper,
      items,
      subtotal,
      totalAmount
    }`,
    { tenantId, trackingToken }
  )
  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'delivery') {
    return NextResponse.json({ error: 'Only delivery orders can be edited' }, { status: 400 })
  }

  const original = order.items ?? []
  const changeSummary: Array<{
    type: 'removed' | 'replaced' | 'edited' | 'not_picked'
    fromName?: string
    toName?: string
    fromQuantity?: number
    toQuantity?: number
    note?: string
  }> = []
  const maxLen = Math.max(original.length, rawItems.length)
  for (let i = 0; i < maxLen; i++) {
    const from = original[i]
    const to = rawItems[i]
    if (from && !to) {
      changeSummary.push({
        type: 'removed',
        fromName: from.productName ?? 'Item',
        fromQuantity: from.quantity ?? 1,
      })
    } else if (!from && to) {
      changeSummary.push({
        type: 'edited',
        toName: (to.productName || '').trim() || 'Item',
        toQuantity: Math.max(1, Math.floor(Number(to.quantity) || 1)),
        note: 'Added by customer',
      })
    } else if (from && to) {
      const fromName = (from.productName ?? '').trim()
      const toName = (to.productName ?? '').trim() || 'Item'
      const fromQty = from.quantity ?? 1
      const toQty = Math.max(1, Math.floor(Number(to.quantity) || 1))
      const nameChanged = fromName !== toName
      const qtyChanged = fromQty !== toQty
      if (nameChanged || qtyChanged) {
        changeSummary.push({
          type: nameChanged ? 'replaced' : 'edited',
          fromName: fromName || 'Item',
          toName,
          fromQuantity: fromQty,
          toQuantity: toQty,
        })
      }
    }
  }

  const productIds = [
    ...new Set(
      rawItems
        .map((item) => (typeof item.productId === 'string' ? item.productId.trim() : ''))
        .filter(Boolean)
    ),
  ]
  if (productIds.length > 0) {
    const validIds = await freshClient.fetch<string[]>(
      `*[_type == "product" && site._ref == $siteId && _id in $productIds]._id`,
      { siteId: tenantId, productIds }
    )
    const validSet = new Set(validIds)
    const invalid = productIds.filter((id) => !validSet.has(id))
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'All products must be from this business' }, { status: 400 })
    }
  }

  const normalizedItems = rawItems.map((item, index) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
    const price = Math.max(0, Number(item.price) || 0)
    const total = quantity * price
    return {
      _type: 'orderItem',
      _key: (item._key && item._key.trim()) ? item._key : `customer-edit-${Date.now()}-${index}`,
      product: item.productId ? { _type: 'reference', _ref: item.productId } : undefined,
      productName: (item.productName || '').trim() || 'Item',
      quantity,
      price,
      total,
      isPicked: true,
      notPickedReason: undefined,
      notes: (item.notes || '').trim(),
      addOns: (item.addOns || '').trim(),
    }
  })

  const subtotal = normalizedItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
  const deliveryFee = typeof order.deliveryFee === 'number' ? Math.max(0, order.deliveryFee) : 0
  const itemCount = normalizedItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const shopperFee = order.requiresPersonalShopper ? getShopperFeeByItemCount(itemCount) : 0
  const totalAmount = subtotal + (order.deliveryFeePaidByBusiness ? 0 : deliveryFee) + shopperFee
  const now = new Date().toISOString()

  await writeClient
    .patch(order._id)
    .set({
      items: normalizedItems,
      subtotal,
      shopperFee,
      totalAmount,
      itemsUpdatedAt: now,
      customerItemChangeStatus: 'pending',
      customerItemChangeRequestedAt: now,
      customerItemChangeResolvedAt: null,
      customerItemChangeResponseNote: null,
      customerRequestedItemChanges: true,
      customerItemChangePreviousSubtotal: order.subtotal ?? 0,
      customerItemChangePreviousTotalAmount: order.totalAmount ?? 0,
      customerItemChangeSummary: changeSummary,
    })
    .commit()

  pusherServer
    .trigger(`order-${order._id}`, 'order-update', { type: 'customer-edit-order', orderId: order._id })
    .catch(() => {})
  pusherServer
    .trigger('driver-global', 'order-update', { type: 'customer-edit-order', orderId: order._id })
    .catch(() => {})

  const driverRef = order.assignedDriver?._ref
  if (driverRef) {
    try {
      const driver = await freshClient.fetch<{
        fcmToken?: string
        pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
      } | null>(
        `*[_type == "driver" && _id == $driverId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
        { driverId: driverRef }
      )
      const orderNum = order.orderNumber ?? order._id.slice(-6)
      const payload = {
        title: '\u200Fالعميل حدّث الطلب',
        body: `العميل أرسل تعديلات على الطلب #${orderNum}. راجع التطبيق للموافقة أو الرفض.`,
        url: '/driver/orders',
        dir: 'rtl' as const,
      }
      if (driver?.fcmToken && isFCMConfigured()) {
        await sendFCMToToken(driver.fcmToken, payload)
      } else {
        const sub = driver?.pushSubscription
        if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
          await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            { title: payload.title, body: payload.body, url: payload.url }
          )
        }
      }
    } catch (e) {
      console.error('[customer-edit-order] Driver push failed:', e)
    }
  }

  sendCustomerOrderStatusPush({
    orderId: order._id,
    newStatus: 'items_changed',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push] items_changed', e))

  return NextResponse.json({
    success: true,
    orderId: order._id,
    subtotal,
    shopperFee,
    totalAmount,
  })
}
