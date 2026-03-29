import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'
import {
  getTableSession,
  saveTableSession,
  clearTableSession,
  createNewTableSession,
  isSessionLeader,
  upsertSessionMember,
  removeSessionMember,
  toSessionSummary,
} from '@/lib/table-session'

export const dynamic = 'force-dynamic'

export type CartItem = {
  productId: string
  cartItemId: string
  quantity: number
  notes?: string
  selectedAddOns?: string[]
  selectedVariants?: (number | undefined)[]
  ownerId: string
  ownerName: string
  [key: string]: unknown
}

export type SharedCartState = {
  hostId: string | null
  items: CartItem[]
  status: 'active' | 'submitted'
}

function getCartKey(slug: string, tableId: string) {
  return `cart:${slug}:${tableId}`
}

function getChannel(slug: string, tableId: string) {
  return `tenant-${slug}-table-${tableId}-cart`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; tableId: string }> }
) {
  const { slug, tableId } = await params
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const key = getCartKey(slug, tableId)
  const cart: SharedCartState | null = await redis.get(key)
  const session = await getTableSession(slug, tableId)

  const base = cart ?? { hostId: null, items: [], status: 'active' as const }
  return NextResponse.json({
    ...base,
    session: session ? toSessionSummary(session) : null,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; tableId: string }> }
) {
  const { slug, tableId } = await params
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { deviceId, action, item, cartItemId, quantity, ownerName, displayName } = body

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  const key = getCartKey(slug, tableId)
  const channel = getChannel(slug, tableId)

  let cart: SharedCartState | null = await redis.get(key)

  if (!cart || cart.status === 'submitted') {
    cart = { hostId: deviceId, items: [], status: 'active' }
  }

  const nameToUse = (displayName || ownerName || 'Guest').trim()

  // ───── SESSION MANAGEMENT ACTIONS ─────

  if (action === 'join_session') {
    const memberName = nameToUse || 'Guest'
    let session = await getTableSession(slug, tableId)

    if (!session || session.status !== 'active') {
      session = createNewTableSession(slug, tableId, { deviceId, displayName: memberName })
      cart.hostId = deviceId
    } else {
      session = upsertSessionMember(session, deviceId, memberName)
      cart.hostId = session.leaderDeviceId
    }

    await saveTableSession(session)
    await redis.setex(key, 7200, cart)
    await pusherServer.trigger(channel, 'cart-updated', cart)
    pusherServer.trigger(channel, 'session-updated', toSessionSummary(session)).catch(() => {})

    return NextResponse.json({ ...cart, session: toSessionSummary(session) })
  }

  if (action === 'leave_session') {
    let session = await getTableSession(slug, tableId)

    // Remove this device's cart items regardless
    cart.items = cart.items.filter((i) => i.ownerId !== deviceId)

    if (session) {
      session = removeSessionMember(session, deviceId)
      if (session.members.length === 0) {
        await clearTableSession(slug, tableId)
        cart.hostId = null
        session = null
      } else {
        cart.hostId = session.leaderDeviceId
        await saveTableSession(session)
      }
    }

    await redis.setex(key, 7200, cart)
    await pusherServer.trigger(channel, 'cart-updated', cart)
    if (session) {
      pusherServer.trigger(channel, 'session-updated', toSessionSummary(session)).catch(() => {})
    }

    return NextResponse.json({ ...cart, session: session ? toSessionSummary(session) : null })
  }

  if (action === 'set_member_name') {
    const newName = nameToUse
    const session = await getTableSession(slug, tableId)
    if (session && newName) {
      const updatedSession = upsertSessionMember(session, deviceId, newName)
      await saveTableSession(updatedSession)
      pusherServer.trigger(channel, 'session-updated', toSessionSummary(updatedSession)).catch(() => {})
    }
    return NextResponse.json({ success: true })
  }

  // ───── CART ITEM ACTIONS ─────

  if (action === 'add_item') {
    const existingIndex = cart.items.findIndex(
      (i) => i.cartItemId === item?.cartItemId && i.ownerId === deviceId
    )
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += item?.quantity || 1
      if (item?.notes !== undefined) cart.items[existingIndex].notes = item.notes
      if (item?.selectedAddOns !== undefined)
        cart.items[existingIndex].selectedAddOns = item.selectedAddOns
      if (item?.selectedVariants !== undefined)
        cart.items[existingIndex].selectedVariants = item.selectedVariants
    } else {
      cart.items.push({ ...item, ownerId: deviceId, ownerName: nameToUse })
    }
  } else if (action === 'remove_item') {
    // Own items only
    cart.items = cart.items.filter(
      (i) => !(i.cartItemId === cartItemId && i.ownerId === deviceId)
    )
  } else if (action === 'remove_item_any') {
    // Leader-only: remove any item regardless of owner
    const session = await getTableSession(slug, tableId)
    if (session && !isSessionLeader(session, deviceId)) {
      return NextResponse.json(
        { error: 'Only the group leader can remove other members\u2019 items' },
        { status: 403 }
      )
    }
    cart.items = cart.items.filter((i) => i.cartItemId !== cartItemId)
  } else if (action === 'update_quantity') {
    const existing = cart.items.find(
      (i) => i.cartItemId === cartItemId && i.ownerId === deviceId
    )
    if (existing) {
      if (quantity <= 0) {
        cart.items = cart.items.filter(
          (i) => !(i.cartItemId === cartItemId && i.ownerId === deviceId)
        )
      } else {
        existing.quantity = quantity
      }
    }
  } else if (action === 'update_item') {
    const existing = cart.items.find(
      (i) => i.cartItemId === cartItemId && i.ownerId === deviceId
    )
    if (existing && item) {
      Object.assign(existing, item)
    }
  } else if (action === 'leave_table') {
    // Legacy compat: remove own items (prefer leave_session for full cleanup)
    cart.items = cart.items.filter((i) => i.ownerId !== deviceId)
  } else if (action === 'clear_cart') {
    // Leader-only
    const session = await getTableSession(slug, tableId)
    if (session && !isSessionLeader(session, deviceId)) {
      return NextResponse.json(
        { error: 'Only the group leader can clear the cart' },
        { status: 403 }
      )
    }
    cart.items = []
  }

  await redis.setex(key, 7200, cart)
  await pusherServer.trigger(channel, 'cart-updated', cart)

  return NextResponse.json(cart)
}
