import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await client.fetch<{ assignedDriverRef?: string; siteRef?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ "assignedDriverRef": assignedDriver._ref, "siteRef": site._ref }`,
    { orderId }
  )
  if (!order?.siteRef) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })

  const products = await client.fetch<
    Array<{
      _id: string
      title_en?: string
      title_ar?: string
      price?: number
      specialPrice?: number
      specialPriceExpires?: string
      currency?: string
      isAvailable?: boolean
    }>
  >(
    `*[_type == "product" && site._ref == $siteId && (isAvailable != false)] | order(title_en asc){
      _id,
      title_en,
      title_ar,
      price,
      specialPrice,
      specialPriceExpires,
      currency,
      isAvailable
    }[0...300]`,
    { siteId: order.siteRef }
  )

  const now = Date.now()
  const normalized = (products || []).map((p) => {
    const specialActive =
      typeof p.specialPrice === 'number' &&
      (!p.specialPriceExpires || new Date(p.specialPriceExpires).getTime() > now)
    return {
      _id: p._id,
      title_en: p.title_en || 'Item',
      title_ar: p.title_ar || p.title_en || 'صنف',
      price: specialActive ? p.specialPrice : (p.price ?? 0),
      currency: p.currency || 'ILS',
    }
  })

  return NextResponse.json({ products: normalized })
}
