import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

/** Strict: only orders belonging to this tenant. No !defined(site) — that would show orphan orders on every tenant. */
const siteFilter = 'site._ref == $siteId'
const noCacheClient = client.withConfig({ useCdn: false })
const ORDERS_GROQ = `*[_type == "order" && ${siteFilter}] | order(createdAt desc)[0...100] {
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
    nickname,
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
  driverDeclinedAssignmentAt,
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
  deliveryRequestedAt,
  autoDeliveryRequestMinutes,
  autoDeliveryRequestScheduledAt,
  autoDeliveryRequestTriggeredAt
}`
const NEW_ORDERS_GROQ = `*[_type == "order" && ${siteFilter} && status == "new"] | order(createdAt desc) {
  _id,
  orderNumber,
  createdAt,
  orderType,
  customerName,
  customerPhone,
  tableNumber,
  deliveryAddress,
  deliveryArea->{_id, name_en, name_ar},
  deliveryLat,
  deliveryLng,
  totalAmount,
  currency,
  scheduledFor,
  notifyAt
}`
const NEW_TABLE_REQUESTS_GROQ = `*[_type == "order" && ${siteFilter} && orderType == "dine-in" && status != "completed" && defined(customerRequestedAt) && !defined(customerRequestAcknowledgedAt)] | order(customerRequestedAt desc) {
  _id,
  orderNumber,
  tableNumber,
  customerRequestType,
  customerRequestPaymentMethod,
  customerRequestedAt
}`
const STANDALONE_TABLE_REQUESTS_GROQ = `*[_type == "tableServiceRequest" && site._ref == $siteId && !defined(acknowledgedAt)] | order(createdAt desc) {
  _id,
  tableNumber,
  type,
  createdAt
}`

/** GET tenant orders + new orders + table requests + standalone table service requests. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const siteId = auth.tenantId
  try {
    const [orders, newOrders, tableRequests, standaloneTableRequests, tenantAutoPrefs] = await Promise.all([
      noCacheClient.fetch(ORDERS_GROQ, { siteId }),
      noCacheClient.fetch(NEW_ORDERS_GROQ, { siteId }),
      noCacheClient.fetch(NEW_TABLE_REQUESTS_GROQ, { siteId }),
      noCacheClient.fetch(STANDALONE_TABLE_REQUESTS_GROQ, { siteId }),
      noCacheClient.fetch<{
        defaultAutoDeliveryRequestMinutes?: number | null
        saveAutoDeliveryRequestPreference?: boolean
      } | null>(
        `*[_type == "tenant" && _id == $siteId][0]{ defaultAutoDeliveryRequestMinutes, saveAutoDeliveryRequestPreference }`,
        { siteId }
      ),
    ])
    return NextResponse.json(
      {
        orders: orders ?? [],
        newOrders: newOrders ?? [],
        tableRequests: tableRequests ?? [],
        standaloneTableRequests: standaloneTableRequests ?? [],
        autoDeliveryDefaults: {
          defaultAutoDeliveryRequestMinutes: tenantAutoPrefs?.defaultAutoDeliveryRequestMinutes ?? null,
          saveAutoDeliveryRequestPreference: tenantAutoPrefs?.saveAutoDeliveryRequestPreference === true,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('[TenantOrders GET]', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
