import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

/** GET: Super admin analytics. Query: from, to (ISO date) for date range; when set, counts and revenue are filtered to that range. */
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
  let dateFilter = ''
  const params: Record<string, string> = {}
  if (fromParam && toParam) {
    dateFilter = ` && createdAt >= $from && createdAt <= $to`
    params.from = fromParam
    params.to = toParam
  }

  const [tenantsCount, driversCount, totalOrdersCount, reportsCount, tenants, orderDocs] = await Promise.all([
    freshClient.fetch<number>(`count(*[_type == "tenant"])`),
    freshClient.fetch<number>(`count(*[_type == "driver"])`),
    freshClient.fetch<number>(`count(*[_type == "order"])`),
    freshClient.fetch<number>(`count(*[_type == "report"])`),
    freshClient.fetch<Array<{ _id: string; name: string; slug: string }>>(
      `*[_type == "tenant"] | order(name asc) { _id, name, "slug": slug.current }`
    ),
    freshClient.fetch<Array<{ siteRef: string | null; status?: string; createdAt?: string; totalAmount?: number }>>(
      `*[_type == "order"${dateFilter}] { "siteRef": site._ref, status, createdAt, totalAmount }`,
      params
    ),
  ])

  const orders = orderDocs ?? []
  const ordersByStatus: Record<string, number> = {}
  const perTenant: Record<string, { orders: number; completed: number; revenue: number; lastOrderAt: string | null }> = {}
  let totalRevenue = 0

  for (const o of orders) {
    const status = o.status ?? 'unknown'
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1
    const amount = typeof o.totalAmount === 'number' && Number.isFinite(o.totalAmount) ? o.totalAmount : 0
    totalRevenue += amount
    const ref = o.siteRef ?? '_no_tenant'
    if (!perTenant[ref]) perTenant[ref] = { orders: 0, completed: 0, revenue: 0, lastOrderAt: null }
    perTenant[ref].orders += 1
    perTenant[ref].revenue += amount
    if (status === 'completed') perTenant[ref].completed += 1
    if (o.createdAt) {
      if (!perTenant[ref].lastOrderAt || o.createdAt > perTenant[ref].lastOrderAt!) {
        perTenant[ref].lastOrderAt = o.createdAt
      }
    }
  }

  const tenantList = tenants ?? []
  const businessStats = tenantList.map((t) => {
    const stats = perTenant[t._id] ?? { orders: 0, completed: 0, revenue: 0, lastOrderAt: null }
    return {
      tenantId: t._id,
      name: t.name,
      slug: t.slug,
      ordersCount: stats.orders,
      completedCount: stats.completed,
      revenue: stats.revenue,
      lastOrderAt: stats.lastOrderAt,
    }
  }).sort((a, b) => b.ordersCount - a.ordersCount)

  const ordersWithNoTenant = perTenant['_no_tenant']?.orders ?? 0

  return NextResponse.json({
    tenantsCount: tenantsCount ?? 0,
    driversCount: driversCount ?? 0,
    ordersCount: dateFilter ? orders.length : (totalOrdersCount ?? 0),
    reportsCount: reportsCount ?? 0,
    ordersByStatus,
    businessStats,
    ordersWithNoTenant,
    totalRevenue,
    dateFrom: fromParam ?? null,
    dateTo: toParam ?? null,
  })
}
