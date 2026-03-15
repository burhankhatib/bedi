import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug, getTenantBySlug } from '@/lib/tenant'
import { toEnglishDigits } from '@/lib/phone'
import { isVerifiedPhoneForUser } from '@/lib/order-auth'
import { NotificationService } from '@/lib/notifications/NotificationService'
import { getShopperFeeByItemCount } from '@/lib/shopper-fee'

function isTenantDeactivated(tenant: { deactivated?: boolean; deactivateUntil?: string | null }): boolean {
  if (!tenant?.deactivated) return false
  const until = tenant.deactivateUntil
  if (!until) return true
  return new Date(until) > new Date()
}

// Create a write client with authentication
const writeClient = client.withConfig({
  token: token,
  useCdn: false,
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in required. Please sign in and verify your phone to place an order.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      orderType,
      customerName,
      tableNumber,
      customerPhone: customerPhoneRaw,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryFee,
      items,
      currency,
      tenantSlug,
      scheduledFor,
      requiresPersonalShopper,
    } = body

    const customerPhone = customerPhoneRaw != null ? toEnglishDigits(String(customerPhoneRaw)) : ''

    // Phone verification: order phone must match a verified phone on the Clerk user
    const phoneMatches = await isVerifiedPhoneForUser(userId, customerPhoneRaw ?? '')
    if (!phoneMatches) {
      return NextResponse.json(
        {
          error:
            'This phone number is not verified. Verify your phone in your account to place an order. Orders from unverified numbers are not accepted.',
        },
        { status: 400 }
      )
    }

    // Super admin block: if this customer is blocked, reject order
    const existingCustomer = await client.fetch<{ blockedBySuperAdmin?: boolean } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ blockedBySuperAdmin }`,
      { userId }
    )
    if (existingCustomer?.blockedBySuperAdmin) {
      return NextResponse.json(
        { error: 'Your account cannot place orders. Please contact support.' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!orderType || !customerName || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate order type specific fields
    if (orderType === 'dine-in') {
      if (!tableNumber) {
        return NextResponse.json(
          { error: 'Table number is required for dine-in orders' },
          { status: 400 }
        )
      }
      if (!customerPhone) {
        return NextResponse.json(
          { error: 'WhatsApp / mobile number is required for dine-in orders' },
          { status: 400 }
        )
      }
    }
    if (orderType === 'receive-in-person' && !customerPhone) {
      return NextResponse.json(
        { error: 'WhatsApp / mobile number is required for pickup orders' },
        { status: 400 }
      )
    }

    if (orderType === 'delivery' && (!customerPhone || !deliveryAddress)) {
      return NextResponse.json(
        { error: 'Phone and address are required for delivery orders' },
        { status: 400 }
      )
    }

    if (orderType === 'delivery' && (typeof deliveryLat !== 'number' || typeof deliveryLng !== 'number')) {
      return NextResponse.json(
        { error: 'Delivery location (lat/lng) is required for delivery orders' },
        { status: 400 }
      )
    }

    // Generate order number (you can customize this format)
    const orderNumber = `ORD-${Date.now()}`

    // Prepare order items for Sanity
    const orderItems = items.map((item: {
      productId?: string
      productName?: string
      quantity?: number
      price?: number
      total?: number
      notes?: string
      addOns?: string
    }) => ({
      _type: 'orderItem',
      _key: Math.random().toString(36).substring(7),
      product: item.productId ? {
        _type: 'reference',
        _ref: item.productId
      } : undefined,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      isPicked: true,
      notes: item.notes || '',
      addOns: item.addOns || '',
    }))

    const computedSubtotal = orderItems.reduce((sum: number, item: { total?: number }) => sum + (item.total ?? 0), 0)
    const totalItemCount = orderItems.reduce((sum: number, item: { quantity?: number }) => sum + Math.max(0, Number(item.quantity) || 0), 0)

    // Resolve site (tenant) for this order; every order must belong to one business.
    let siteRef: { _type: 'reference'; _ref: string } | undefined
    if (tenantSlug && typeof tenantSlug === 'string') {
      const tenant = await getTenantBySlug(tenantSlug)
      if (tenant?.blockedBySuperAdmin) {
        return NextResponse.json(
          { error: 'This business is currently unavailable. Orders are not accepted.' },
          { status: 403 }
        )
      }
      if (tenant && isTenantDeactivated(tenant)) {
        return NextResponse.json(
          { error: 'This business is temporarily closed. Orders are not accepted right now.' },
          { status: 403 }
        )
      }
      const tenantId = tenant?._id ?? await getTenantIdBySlug(tenantSlug)
      if (tenantId) siteRef = { _type: 'reference', _ref: tenantId }
    }
    // Fallback: infer tenant from referenced products when tenantSlug is missing.
    if (!siteRef) {
      const productIds = [...new Set(
        (items as Array<{ productId?: string }>).map((i) => (typeof i?.productId === 'string' ? i.productId.trim() : '')).filter(Boolean)
      )]
      if (productIds.length > 0) {
        const productSites = await writeClient.fetch<Array<{ siteId?: string }>>(
          `*[_type == "product" && _id in $ids]{ "siteId": site._ref }`,
          { ids: productIds }
        )
        const siteIds = [...new Set((productSites ?? []).map((p) => p?.siteId).filter(Boolean))]
        if (siteIds.length === 1) {
          siteRef = { _type: 'reference', _ref: siteIds[0]! }
        } else if (siteIds.length > 1) {
          return NextResponse.json(
            { error: 'Cart contains items from multiple businesses. Please checkout one business at a time.' },
            { status: 400 }
          )
        }
      }
    }
    if (!siteRef) {
      return NextResponse.json(
        { error: 'Business could not be determined for this order. Please open the business menu and try again.' },
        { status: 400 }
      )
    }
    const targetTenant = await writeClient.fetch<{
      blockedBySuperAdmin?: boolean
      deactivated?: boolean
      deactivateUntil?: string | null
      requiresPersonalShopper?: boolean
      supportsDriverPickup?: boolean
    } | null>(
      `*[_type == "tenant" && _id == $id][0]{ blockedBySuperAdmin, deactivated, deactivateUntil, requiresPersonalShopper, supportsDriverPickup }`,
      { id: siteRef._ref }
    )
    if (!targetTenant || targetTenant.blockedBySuperAdmin || isTenantDeactivated(targetTenant)) {
      return NextResponse.json(
        { error: 'This business is currently unavailable. Orders are not accepted.' },
        { status: 403 }
      )
    }

    // Create order document
    const orderDoc: Record<string, unknown> = {
      _type: 'order',
      ...(siteRef && { site: siteRef }),
      orderNumber,
      orderType,
      status: 'new',
      customerName,
      items: orderItems,
      subtotal: computedSubtotal,
      totalAmount: computedSubtotal,
      currency: currency || 'ILS',
      createdAt: new Date().toISOString(),
    }

    if (scheduledFor) {
      const scheduledTime = new Date(scheduledFor)
      orderDoc.scheduledFor = scheduledTime.toISOString()
      
      // Calculate notifyAt: 1 hour before scheduled time
      const reminderMinutes = 60
      const notifyTime = new Date(scheduledTime.getTime() - reminderMinutes * 60000)
      orderDoc.notifyAt = notifyTime.toISOString()
    }

    // Add type-specific fields (customerPhone for contact on all non-delivery types too)
    if (orderType === 'dine-in') {
      orderDoc.tableNumber = tableNumber
      orderDoc.customerPhone = customerPhone
    } else if (orderType === 'receive-in-person') {
      orderDoc.customerPhone = customerPhone
    } else if (orderType === 'delivery') {
      orderDoc.customerPhone = customerPhone
      orderDoc.deliveryAddress = deliveryAddress
      const safeDeliveryFee = typeof deliveryFee === 'number' && Number.isFinite(deliveryFee) ? Math.max(0, deliveryFee) : 0
      orderDoc.deliveryFee = safeDeliveryFee
      const tenantRequiresPersonalShopper = targetTenant?.requiresPersonalShopper === true || requiresPersonalShopper === true
      const shopperFee = tenantRequiresPersonalShopper ? getShopperFeeByItemCount(totalItemCount) : 0
      if (tenantRequiresPersonalShopper) {
        orderDoc.requiresPersonalShopper = true
        orderDoc.shopperFee = shopperFee
      }
      orderDoc.totalAmount = computedSubtotal + safeDeliveryFee + shopperFee
      const shouldAutoDispatchDriverPickup =
        targetTenant?.supportsDriverPickup === true &&
        !scheduledFor
      if (shouldAutoDispatchDriverPickup) {
        orderDoc.deliveryRequestedAt = new Date().toISOString()
      }
      if (typeof deliveryLat === 'number' && Number.isFinite(deliveryLat) && typeof deliveryLng === 'number' && Number.isFinite(deliveryLng)) {
        orderDoc.deliveryLat = deliveryLat
        orderDoc.deliveryLng = deliveryLng
      }
    }

    // Save order to Sanity
    console.log('[API] Creating order:', {
      orderType,
      status: orderDoc.status,
      orderNumber: orderDoc.orderNumber,
      hasTableNumber: orderType === 'dine-in' ? !!orderDoc.tableNumber : 'N/A',
      hasPhone: orderType === 'delivery' ? !!orderDoc.customerPhone : 'N/A',
    })
    // receive-in-person: no extra fields
    
    const result = await writeClient.create(orderDoc as { _type: string } & Record<string, unknown>) as unknown as { _id: string; orderNumber: string; orderType?: string; status?: string }

    const trackingToken = crypto.randomUUID().replace(/-/g, '')
    await writeClient.patch(result._id).set({ trackingToken }).commit()

    // Upsert customer so we can see all customers across businesses in Sanity
    try {
      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(userId)
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? ''
      const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || undefined
      const now = new Date().toISOString()

      const existing = await writeClient.fetch<{ _id: string; orderCount?: number } | null>(
        `*[_type == "customer" && clerkUserId == $userId][0]{ _id, orderCount }`,
        { userId }
      )

      let customerId: string
      if (existing) {
        await writeClient
          .patch(existing._id)
          .set({
            lastOrderAt: now,
            orderCount: (existing.orderCount ?? 0) + 1,
            ...(clerkName && { name: clerkName }),
            ...(email && { email }),
            primaryPhone: customerPhone || undefined,
          })
          .commit()
        customerId = existing._id
      } else {
        const created = await writeClient.create({
          _type: 'customer',
          clerkUserId: userId,
          name: clerkName || customerName || undefined,
          email: email || undefined,
          primaryPhone: customerPhone || undefined,
          firstOrderAt: now,
          lastOrderAt: now,
          orderCount: 1,
        })
        customerId = created._id
      }

      await writeClient.patch(result._id).set({ customer: { _type: 'reference', _ref: customerId } }).commit()
    } catch (e) {
      console.warn('[API] Customer upsert failed (order still created):', e)
    }

    console.log('[API] Order created successfully:', {
      orderId: result._id,
      orderNumber: result.orderNumber,
      orderType: result.orderType,
      status: result.status,
    })

    let siteSlug: string | undefined = typeof tenantSlug === 'string' ? tenantSlug.trim() || undefined : undefined
    if (siteRef?._ref) {
      try {
        // Fetch tenant to get the proper name for the notification
        const tenantDoc = await writeClient.fetch<{ name?: string; name_ar?: string; slug?: { current?: string }; ownerPhone?: string; prioritizeWhatsapp?: boolean } | null>(
          `*[_type == "tenant" && _id == $id][0]{ name, name_ar, slug, ownerPhone, prioritizeWhatsapp }`,
          { id: siteRef._ref }
        )
        siteSlug = (tenantDoc?.slug?.current || siteSlug)?.trim() || undefined

        // Fire centralized notification service (handles Pusher, FCM, and WhatsApp)
        await NotificationService.onNewOrder({
          orderId: result._id,
          orderNumber: result.orderNumber,
          tenantId: siteRef._ref,
          tenantSlug: siteSlug || '',
          tenantName: tenantDoc?.name,
          tenantNameAr: tenantDoc?.name_ar,
          tenantPhone: tenantDoc?.ownerPhone,
          prioritizeWhatsapp: tenantDoc?.prioritizeWhatsapp
        })

        if (orderType === 'delivery' && targetTenant?.supportsDriverPickup === true && !scheduledFor) {
          const { notifyDriversOfDeliveryOrder } = await import('@/lib/notify-drivers-for-order')
          await notifyDriversOfDeliveryOrder(result._id)
          console.info('[API] Auto-dispatched driver pickup order:', {
            orderId: result._id,
            tenantId: siteRef._ref,
          })
        }
      } catch (e) {
        console.error('[API] Tenant pusher trigger or push notification on new order failed:', e)
      }
    }

    return NextResponse.json({
      success: true,
      orderId: result._id,
      orderNumber: result.orderNumber,
      trackingToken,
      siteSlug,
    })

  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
