import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

type DeliveryAnalyticsShape = {
  completedDeliveryOrders: number
  sponsoredDeliveryCompleted: number
  customerPaidDeliveryCompleted: number
}

type CompletionOrderRow = {
  siteRef: string | null
  deliveryFeePaidByBusiness?: boolean
}

/** GET: Super admin analytics. Query: from, to (ISO date) for date range; when set, counts and revenue are filtered to that range.
 * `download=1` returns the same payload as an attached JSON file for dashboards.
 * Delivery "operations" metrics (deliveryAnalyticsByCompletion) use completedAt in range when from/to are set. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const download = searchParams.get('download') === '1'
  let dateFilter = ''
  const params: Record<string, string> = {}
  if (fromParam && toParam) {
    dateFilter = ` && createdAt >= $from && createdAt <= $to`
    params.from = fromParam
    params.to = toParam
  }

  const completionFetch =
    fromParam && toParam
      ? freshClient.fetch<CompletionOrderRow[]>(
          `*[_type == "order" && status == "completed" && orderType == "delivery" && defined(completedAt) && completedAt >= $from && completedAt <= $to] {
            "siteRef": site._ref,
            deliveryFeePaidByBusiness
          }`,
          params
        )
      : Promise.resolve([] as CompletionOrderRow[])

  const [tenantsCount, driversCount, totalOrdersCount, reportsCount, tenants, orderDocs, completionOrderDocs] =
    await Promise.all([
      freshClient.fetch<number>(`count(*[_type == "tenant"])`),
      freshClient.fetch<number>(`count(*[_type == "driver"])`),
      freshClient.fetch<number>(`count(*[_type == "order"])`),
      freshClient.fetch<number>(`count(*[_type == "report"])`),
      freshClient.fetch<Array<{ _id: string; name: string; slug: string }>>(
        `*[_type == "tenant"] | order(name asc) { _id, name, "slug": slug.current }`
      ),
      freshClient.fetch<
        Array<{
          siteRef: string | null
          status?: string
          createdAt?: string
          totalAmount?: number
          orderType?: string
          deliveryFeePaidByBusiness?: boolean
        }>
      >(
        `*[_type == "order"${dateFilter}] { "siteRef": site._ref, status, createdAt, totalAmount, orderType, deliveryFeePaidByBusiness }`,
        params
      ),
      completionFetch,
    ])

  const orders = orderDocs ?? []
  const ordersByStatus: Record<string, number> = {}
  const perTenant: Record<
    string,
    {
      orders: number
      completed: number
      revenue: number
      lastOrderAt: string | null
      deliveryCompleted: number
      sponsoredDelivery: number
      customerPaidDelivery: number
    }
  > = {}
  let totalRevenue = 0
  const deliveryAnalytics: DeliveryAnalyticsShape = {
    completedDeliveryOrders: 0,
    sponsoredDeliveryCompleted: 0,
    customerPaidDeliveryCompleted: 0,
  }

  for (const o of orders) {
    const status = o.status ?? 'unknown'
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1
    const amount = typeof o.totalAmount === 'number' && Number.isFinite(o.totalAmount) ? o.totalAmount : 0
    totalRevenue += amount
    const ref = o.siteRef ?? '_no_tenant'
    if (!perTenant[ref]) {
      perTenant[ref] = {
        orders: 0,
        completed: 0,
        revenue: 0,
        lastOrderAt: null,
        deliveryCompleted: 0,
        sponsoredDelivery: 0,
        customerPaidDelivery: 0,
      }
    }
    perTenant[ref].orders += 1
    perTenant[ref].revenue += amount
    if (status === 'completed') perTenant[ref].completed += 1
    if (status === 'completed' && o.orderType === 'delivery') {
      deliveryAnalytics.completedDeliveryOrders += 1
      perTenant[ref].deliveryCompleted += 1
      if (o.deliveryFeePaidByBusiness === true) {
        deliveryAnalytics.sponsoredDeliveryCompleted += 1
        perTenant[ref].sponsoredDelivery += 1
      } else {
        deliveryAnalytics.customerPaidDeliveryCompleted += 1
        perTenant[ref].customerPaidDelivery += 1
      }
    }
    if (o.createdAt) {
      if (!perTenant[ref].lastOrderAt || o.createdAt > perTenant[ref].lastOrderAt!) {
        perTenant[ref].lastOrderAt = o.createdAt
      }
    }
  }

  let deliveryAnalyticsByCompletion: DeliveryAnalyticsShape | null = null
  const perTenantOps: Record<
    string,
    { deliveryCompleted: number; sponsoredDelivery: number; customerPaidDelivery: number }
  > = {}

  if (fromParam && toParam) {
    const da: DeliveryAnalyticsShape = {
      completedDeliveryOrders: 0,
      sponsoredDeliveryCompleted: 0,
      customerPaidDeliveryCompleted: 0,
    }
    for (const o of completionOrderDocs ?? []) {
      da.completedDeliveryOrders += 1
      const ref = o.siteRef ?? '_no_tenant'
      if (!perTenantOps[ref]) {
        perTenantOps[ref] = { deliveryCompleted: 0, sponsoredDelivery: 0, customerPaidDelivery: 0 }
      }
      perTenantOps[ref].deliveryCompleted += 1
      if (o.deliveryFeePaidByBusiness === true) {
        da.sponsoredDeliveryCompleted += 1
        perTenantOps[ref].sponsoredDelivery += 1
      } else {
        da.customerPaidDeliveryCompleted += 1
        perTenantOps[ref].customerPaidDelivery += 1
      }
    }
    deliveryAnalyticsByCompletion = da
  }

  const emptyOps = { deliveryCompleted: 0, sponsoredDelivery: 0, customerPaidDelivery: 0 }

  const tenantList = tenants ?? []
  const businessStats = tenantList.map((t) => {
    const stats = perTenant[t._id] ?? {
      orders: 0,
      completed: 0,
      revenue: 0,
      lastOrderAt: null,
      deliveryCompleted: 0,
      sponsoredDelivery: 0,
      customerPaidDelivery: 0,
    }
    const ops = deliveryAnalyticsByCompletion ? (perTenantOps[t._id] ?? emptyOps) : null
    return {
      tenantId: t._id,
      name: t.name,
      slug: t.slug,
      ordersCount: stats.orders,
      completedCount: stats.completed,
      revenue: stats.revenue,
      lastOrderAt: stats.lastOrderAt,
      deliveryCompleted: stats.deliveryCompleted,
      sponsoredDelivery: stats.sponsoredDelivery,
      customerPaidDelivery: stats.customerPaidDelivery,
      deliveryCompletedOps: ops?.deliveryCompleted ?? null,
      sponsoredDeliveryOps: ops?.sponsoredDelivery ?? null,
      customerPaidDeliveryOps: ops?.customerPaidDelivery ?? null,
    }
  }).sort((a, b) => b.ordersCount - a.ordersCount)

  const ordersWithNoTenant = perTenant['_no_tenant']?.orders ?? 0

  const body = {
    tenantsCount: tenantsCount ?? 0,
    driversCount: driversCount ?? 0,
    ordersCount: dateFilter ? orders.length : (totalOrdersCount ?? 0),
    reportsCount: reportsCount ?? 0,
    ordersByStatus,
    businessStats,
    ordersWithNoTenant,
    totalRevenue,
    deliveryAnalytics,
    deliveryAnalyticsByCompletion,
    meta: {
      orderWindow: 'createdAt' as const,
      deliveryBreakdownByOrderCreatedAt: true,
      deliveryBreakdownByCompletionAt: Boolean(deliveryAnalyticsByCompletion),
    },
    dateFrom: fromParam ?? null,
    dateTo: toParam ?? null,
  }

  if (download) {
    const safeFrom = fromParam?.slice(0, 10) ?? 'all'
    const safeTo = toParam?.slice(0, 10) ?? 'all'
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="zonify-admin-stats_${safeFrom}_${safeTo}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json(body)
}
