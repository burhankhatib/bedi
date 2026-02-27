import { redirect } from 'next/navigation'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'
import { ANALYTICS_QUERY_TENANT } from '@/sanity/lib/queries'
import { AnalyticsClient } from '@/app/(main)/analytics/AnalyticsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TenantAnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'analytics')) redirect(`/t/${slug}/manage`)

  let orders: Array<{
    _id: string
    orderNumber: string
    orderType: string
    status: string
    customerName: string
    items: Array<{ productName: string; quantity: number; total: number }>
    totalAmount: number
    deliveryFee?: number
    currency: string
    createdAt: string
    deliveryArea?: { name_en: string }
    assignedDriver?: { _id: string; name?: string }
  }> = []

  try {
    orders = (await client.fetch(ANALYTICS_QUERY_TENANT, { siteId: auth.tenantId })) ?? []
  } catch (error) {
    console.error('[Tenant Analytics] Failed to fetch orders:', error)
  }

  return (
    <AnalyticsClient
      initialOrders={orders}
      wrapWithAdmin={false}
      variant="tenant"
      title="Analytics"
      subtitle="Track orders, revenue, and performance for your site"
    />
  )
}
