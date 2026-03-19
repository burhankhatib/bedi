import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

const ORDER_GROQ = `*[_type == "order" && _id == $orderId][0]{
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  tableNumber,
  customerPhone,
  deliveryArea->{_id, name_en, name_ar},
  deliveryAddress,
  deliveryLat,
  deliveryLng,
  deliveryFee,
  deliveryFeePaidByBusiness,
  assignedDriver->{
    _id,
    name,
    phoneNumber,
    deliveryAreas[]->{_id, name_en, name_ar}
  },
  items,
  subtotal,
  totalAmount,
  currency,
  createdAt,
  preparedAt,
  driverAcceptedAt,
  driverPickedUpAt,
  completedAt,
  cancelledAt,
  driverCancelledAt,
  customerRequestType,
  customerRequestPaymentMethod,
  customerRequestedAt,
  customerRequestAcknowledgedAt,
  tipPercent,
  tipAmount,
  tipSentToDriver,
  tipIncludedInTotal,
  tipRemovedByDriver,
  driverArrivedAt,
  scheduledFor,
  acknowledgedAt,
  notifyAt,
  reminderSent,
  "tenantSlug": site->slug.current
}`

/** GET: Fetch a single order by ID (super admin only). Returns order + tenantSlug for View Order. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderId } = await params
  if (!orderId?.trim()) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const order = await freshClient.fetch(ORDER_GROQ, { orderId })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  return NextResponse.json({ order, tenantSlug: order.tenantSlug ?? null })
}
