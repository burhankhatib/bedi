import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'

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
  [key: string]: any
}

export type SharedCartState = {
  hostId: string | null
  items: CartItem[]
  status: 'active' | 'submitted'
}

function getCartKey(slug: string, tableId: string) {
  return `cart:${slug}:${tableId}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; tableId: string }> }
) {
  const { slug, tableId } = await params
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const key = getCartKey(slug, tableId)
  const cart: SharedCartState | null = await redis.get(key)

  if (!cart) {
    return NextResponse.json({ hostId: null, items: [], status: 'active' })
  }

  return NextResponse.json(cart)
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
  const { deviceId, action, item, cartItemId, quantity, ownerName } = body

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  const key = getCartKey(slug, tableId)
  
  // Basic GET/SET for simplicity, assuming low collision probability for table carts.
  let cart: SharedCartState | null = await redis.get(key)

  if (!cart || cart.status === 'submitted') {
    cart = {
      hostId: deviceId, // Kept for legacy/informative purposes
      items: [],
      status: 'active',
    }
  }

  const nameToUse = ownerName || 'Guest'

  if (action === 'add_item') {
    const existingIndex = cart.items.findIndex(i => i.cartItemId === item.cartItemId && i.ownerId === deviceId)
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += (item.quantity || 1)
      if (item.notes !== undefined) cart.items[existingIndex].notes = item.notes
      if (item.selectedAddOns !== undefined) cart.items[existingIndex].selectedAddOns = item.selectedAddOns
      if (item.selectedVariants !== undefined) cart.items[existingIndex].selectedVariants = item.selectedVariants
    } else {
      cart.items.push({ ...item, ownerId: deviceId, ownerName: nameToUse })
    }
  } else if (action === 'remove_item') {
    cart.items = cart.items.filter(i => !(i.cartItemId === cartItemId && i.ownerId === deviceId))
  } else if (action === 'remove_item_any') { // Allows removing other people's items
    cart.items = cart.items.filter(i => i.cartItemId !== cartItemId)
  } else if (action === 'update_quantity') {
    const existing = cart.items.find(i => i.cartItemId === cartItemId && i.ownerId === deviceId)
    if (existing) {
      if (quantity <= 0) {
        cart.items = cart.items.filter(i => !(i.cartItemId === cartItemId && i.ownerId === deviceId))
      } else {
        existing.quantity = quantity
      }
    }
  } else if (action === 'update_item') {
    const existing = cart.items.find(i => i.cartItemId === cartItemId && i.ownerId === deviceId)
    if (existing && item) {
      Object.assign(existing, item)
    }
  } else if (action === 'leave_table') {
    cart.items = cart.items.filter(i => i.ownerId !== deviceId)
  } else if (action === 'clear_cart') {
    cart.items = []
  }

  await redis.setex(key, 7200, cart)

  const channel = `tenant-${slug}-table-${tableId}-cart`
  await pusherServer.trigger(channel, 'cart-updated', cart)

  return NextResponse.json(cart)
}
