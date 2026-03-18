import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { pusherServer } from '@/lib/pusher'
import { getShopperFeeByItemCount } from '@/lib/shopper-fee'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { isDriverAtBusiness } from '@/lib/driver-items-lock'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type IncomingOrderItem = {
  _key?: string
  productId?: string
  productName?: string
  quantity?: number
  saleUnit?: string
  price?: number
  total?: number
  notes?: string
  addOns?: string
  isPicked?: boolean
  notPickedReason?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { orderId } = await params
  let body: {
    items?: IncomingOrderItem[]
    changeSummary?: Array<{
      type?: 'removed' | 'replaced' | 'edited' | 'not_picked'
      fromName?: string
      toName?: string
      fromQuantity?: number
      toQuantity?: number
      note?: string
    }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
  }

  const driver = await client.fetch<{ _id: string; lastKnownLat?: number; lastKnownLng?: number } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, lastKnownLat, lastKnownLng }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await client.fetch<{
    _id: string
    assignedDriverRef?: string
    siteRef?: string
    orderType?: string
    deliveryFee?: number
    requiresPersonalShopper?: boolean
    subtotal?: number
    totalAmount?: number
    status?: string
    driverPickedUpAt?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id,
      "assignedDriverRef": assignedDriver._ref,
      "siteRef": site._ref,
      orderType,
      deliveryFee,
      requiresPersonalShopper,
      subtotal,
      totalAmount,
      status,
      driverPickedUpAt
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  if (order.orderType !== 'delivery') return NextResponse.json({ error: 'Only delivery orders can be updated' }, { status: 400 })
  if (!order.siteRef) return NextResponse.json({ error: 'Order business is missing' }, { status: 400 })

  if (order.status !== 'out-for-delivery' && !order.driverPickedUpAt) {
    const tenant = await client.fetch<{ locationLat?: number; locationLng?: number } | null>(
      `*[_type == "tenant" && _id == $id][0]{ locationLat, locationLng }`,
      { id: order.siteRef }
    )
    const hasLocation = tenant?.locationLat != null && tenant?.locationLng != null
    if (hasLocation && !isDriverAtBusiness(driver.lastKnownLat, driver.lastKnownLng, tenant?.locationLat, tenant?.locationLng)) {
      const restaurant = await client.fetch<{ name_en?: string; name_ar?: string } | null>(
        `*[_type == "restaurantInfo" && site._ref == $id][0]{ name_en, name_ar }`,
        { id: order.siteRef }
      )
      const businessName = restaurant?.name_ar || restaurant?.name_en || 'المتجر'
      return NextResponse.json(
        { error: `يجب أن تكون في ${businessName} لتحديث العناصر.`, errorEn: `You must be at ${businessName} to update items.` },
        { status: 403 }
      )
    }
  }

  const productIds = [
    ...new Set(
      body.items
        .map((item) => (typeof item.productId === 'string' ? item.productId.trim() : ''))
        .filter(Boolean)
    ),
  ]
  if (productIds.length > 0) {
    const validIds = await client.fetch<string[]>(
      `*[_type == "product" && site._ref == $siteId && _id in $productIds]._id`,
      { siteId: order.siteRef, productIds }
    )
    const validSet = new Set(validIds)
    const invalid = productIds.filter((id) => !validSet.has(id))
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'Replacement items must be from the same business' }, { status: 400 })
    }
  }

  const normalizedItems = body.items.map((item, index) => {
    const isWeight = item.saleUnit === 'kg' || item.saleUnit === 'g'
    const minQty = isWeight ? 0.05 : 1
    const rawQty = Number(item.quantity) || minQty
    const quantity = isWeight ? Math.max(minQty, Math.round(rawQty * 100) / 100) : Math.max(1, Math.floor(rawQty))
    const price = Math.max(0, Number(item.price) || 0)
    return {
      _type: 'orderItem',
      _key: item._key && item._key.trim() ? item._key : `driver-item-${Date.now()}-${index}`,
      product: item.productId ? { _type: 'reference', _ref: item.productId } : undefined,
      productName: (item.productName || '').trim() || 'Item',
      quantity,
      saleUnit: (item.saleUnit || '').trim() || undefined,
      price,
      total: Number.isFinite(item.total as number) ? Math.max(0, Number(item.total)) : quantity * price,
      isPicked: item.isPicked !== false,
      notPickedReason: (item.notPickedReason || '').trim() || undefined,
      notes: (item.notes || '').trim(),
      addOns: (item.addOns || '').trim(),
    }
  })

  const subtotal = normalizedItems.reduce((sum, item) => sum + (item.isPicked !== false ? (item.total || 0) : 0), 0)
  const deliveryFee = typeof order.deliveryFee === 'number' ? Math.max(0, order.deliveryFee) : 0
  const itemCount = normalizedItems.reduce((sum, item) => sum + (item.isPicked !== false ? (item.quantity || 0) : 0), 0)
  const shopperFee = order.requiresPersonalShopper ? getShopperFeeByItemCount(itemCount) : 0
  const totalAmount = subtotal + deliveryFee + shopperFee
  const now = new Date().toISOString()

  await writeClient
    .patch(orderId)
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
      customerItemChangePreviousSubtotal: order.subtotal ?? 0,
      customerItemChangePreviousTotalAmount: order.totalAmount ?? 0,
      customerItemChangeSummary: Array.isArray(body.changeSummary) ? body.changeSummary : [],
    })
    .commit()

  pusherServer
    .trigger(`order-${orderId}`, 'order-update', { type: 'items-changed-by-driver', orderId })
    .catch(() => {})
  pusherServer
    .trigger('driver-global', 'order-update', { type: 'items-changed-by-driver', orderId })
    .catch(() => {})

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'items_changed',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => {
    console.warn('[customer-order-push] items_changed', e)
  })

  return NextResponse.json({
    success: true,
    orderId,
    subtotal,
    shopperFee,
    totalAmount,
  })
}
