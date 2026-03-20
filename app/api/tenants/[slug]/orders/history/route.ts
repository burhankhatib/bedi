import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/** Strict: only orders belonging to this tenant. */
const siteFilter = 'site._ref == $siteId'
const ORDERS_GROQ = `*[_type == "order" && ${siteFilter}] | order(createdAt desc) {
  _id,
  orderNumber,
  orderType,
  status,
  customerName,
  tableNumber,
  customerPhone,
  deliveryArea->{_id, name_en, name_ar},
  deliveryAddress,
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
  tipPercent,
  tipAmount,
  tipSentToDriver,
  tipIncludedInTotal,
  tipRemovedByDriver,
  driverArrivedAt
}`

const TABLE_REQUESTS_GROQ = `*[_type == "tableServiceRequest" && site._ref == $siteId && defined(acknowledgedAt)] | order(createdAt desc) {
  _id,
  tableNumber,
  type,
  createdAt,
  acknowledgedAt
}`

/** GET tenant order history. Optional ?q= for search (order number, customer name, phone). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const siteId = auth.tenantId
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const refresh = searchParams.get('refresh') === '1'
  const sanityClient = refresh ? clientNoCdn : client

  try {
    const [ordersResult, tableRequestsResult] = await Promise.all([
      sanityClient.fetch(ORDERS_GROQ, { siteId }),
      sanityClient.fetch(TABLE_REQUESTS_GROQ, { siteId })
    ])
    
    let filteredOrders = (ordersResult ?? []) as Array<{
      _id: string
      orderNumber?: string
      customerName?: string
      customerPhone?: string
      [key: string]: unknown
    }>
    
    let filteredTableRequests = (tableRequestsResult ?? []) as Array<{
      _id: string
      tableNumber?: string
      [key: string]: unknown
    }>

    if (q) {
      filteredOrders = filteredOrders.filter((o) => {
        const num = String(o.orderNumber ?? '').toLowerCase()
        const name = String(o.customerName ?? '').toLowerCase()
        const phone = String(o.customerPhone ?? '').replace(/\s/g, '')
        const qNorm = q.replace(/\s/g, '')
        return num.includes(q) || name.includes(q) || phone.includes(qNorm)
      })
      
      filteredTableRequests = filteredTableRequests.filter((r) => {
        const num = String(r.tableNumber ?? '').toLowerCase()
        return num.includes(q)
      })
    }
    
    return NextResponse.json(
      { orders: filteredOrders, tableRequests: filteredTableRequests },
      { headers: { 'Cache-Control': refresh ? 'no-store' : 'private, max-age=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('[TenantOrdersHistory GET]', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
