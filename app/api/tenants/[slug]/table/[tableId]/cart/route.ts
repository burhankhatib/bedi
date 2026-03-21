import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

export type CartItem = {
  productId: string
  productName: string
  title: string
  price: number
  quantity: number
  notes?: string
  addOns?: string
  total: number
  imageUrl?: string
  currency: string
  ownerId: string
  ownerName: string
}

export type SharedCartState = {
  hostId: string
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
  const { deviceId, action, items, ownerName } = body

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  const key = getCartKey(slug, tableId)
  let cart: SharedCartState | null = await redis.get(key)

  if (!cart || cart.status === 'submitted') {
    // If cart is empty, the first person to add something or initiate becomes host
    cart = {
      hostId: deviceId,
      items: [],
      status: 'active',
    }
  }

  // Update logic based on action
  if (action === 'update_items') {
    // Replace items owned by this deviceId, keep others
    const otherItems = cart.items.filter((i) => i.ownerId !== deviceId)
    const newItems = (items || []).map((i: any) => ({
      ...i,
      ownerId: i.ownerId || deviceId, // preserve existing ownerId if any
      ownerName: i.ownerName || ownerName || 'Guest',
    }))
    cart.items = [...otherItems, ...newItems]
  } else if (action === 'host_replace_items') {
    // Host can replace the entire cart (e.g. to delete anyone's item)
    if (cart.hostId === deviceId) {
      cart.items = items
    }
  } else if (action === 'clear') {
    if (cart.hostId === deviceId) {
      cart.items = []
    }
  }

  // Save back to redis with 2 hour TTL (7200 seconds)
  await redis.setex(key, 7200, cart)

  // Broadcast
  const channel = `tenant-${slug}-table-${tableId}-cart`
  await pusherServer.trigger(channel, 'cart-updated', cart)

  return NextResponse.json(cart)
}
