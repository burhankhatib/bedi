import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { client } from '@/sanity/lib/client'

const freshClient = client.withConfig({ useCdn: false })
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { ArrowLeft } from 'lucide-react'
import type { Order } from '@/app/(main)/orders/OrdersClient'
import { TenantOrdersLive, type TableRequest } from './TenantOrdersLive'
import { OrdersPWASetup } from './OrdersPWASetup'
import { OrdersPushRefreshButton } from './OrdersPushRefreshButton'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { OrdersPushGateWrapper } from './OrdersPushGateWrapper'
import { enforcePhoneVerification } from '@/lib/enforce-phone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { manifest: `/t/${slug}/orders/manifest.webmanifest` }
}

export default async function TenantOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ open?: string }>
}) {
  const { slug } = await params
  const { open: initialOpenOrderId } = await searchParams
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) redirect('/dashboard')
  if (!requirePermission(auth, 'orders')) redirect(`/t/${slug}/manage`)

  await enforcePhoneVerification(`/t/${slug}/orders`)

  const siteId = auth.tenantId
  const siteFilter = '(site._ref == $siteId || !defined(site))'
  const standaloneTableRequestsGROQ = `*[_type == "tableServiceRequest" && site._ref == $siteId && !defined(acknowledgedAt)] | order(createdAt desc) {
    _id,
    tableNumber,
    type,
    createdAt
  }`
  let orders: Order[] = []
  let newOrders: Array<{ _id: string; orderNumber: string; createdAt: string }> = []
  let tableRequests: TableRequest[] = []
  let standaloneTableRequests: Array<{ _id: string; tableNumber: string; type: string; createdAt: string }> = []
  let notificationSound: string | null = null

  try {
    const [ordersList, newOrdersList, tableRequestsList, standaloneList] = await Promise.all([
      freshClient.fetch(`*[_type == "order" && ${siteFilter}] | order(createdAt desc) {
        _id, orderNumber, orderType, status, customerName, tableNumber, customerPhone,
        deliveryArea->{_id, name_en, name_ar}, deliveryAddress, deliveryFee,
        assignedDriver->{_id, name, phoneNumber, deliveryAreas[]->{_id, name_en, name_ar}},
        items, subtotal, totalAmount, currency, createdAt, completedAt,
        customerRequestType, customerRequestPaymentMethod, customerRequestedAt, customerRequestAcknowledgedAt,
        tipPercent, tipAmount
      }`, { siteId }),
      freshClient.fetch(`*[_type == "order" && ${siteFilter} && status == "new"] | order(createdAt desc) {
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
        currency
      }`, { siteId }),
      freshClient.fetch(`*[_type == "order" && ${siteFilter} && orderType == "dine-in" && status != "completed" && defined(customerRequestedAt) && !defined(customerRequestAcknowledgedAt)] | order(customerRequestedAt desc) {
        _id, orderNumber, tableNumber, customerRequestType, customerRequestPaymentMethod, customerRequestedAt
      }`, { siteId }),
      freshClient.fetch(standaloneTableRequestsGROQ, { siteId }),
    ])
    orders = (ordersList ?? []) as Order[]
    newOrders = (newOrdersList ?? []) as Array<{ _id: string; orderNumber: string; createdAt: string }>
    tableRequests = (tableRequestsList ?? []) as TableRequest[]
    standaloneTableRequests = (standaloneList ?? []) as Array<{ _id: string; tableNumber: string; type: string; createdAt: string }>
  } catch (error) {
    console.error('[TenantOrders] Failed to fetch orders:', error)
  }

  try {
    const rest = await client.fetch<{ notificationSound?: string } | null>(
      `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ notificationSound }`,
      { siteId }
    )
    notificationSound = rest?.notificationSound ?? null
  } catch {
    // use default in client
  }

  return (
    <OrdersPushGateWrapper slug={slug}>
      <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
        <AppNav variant="dashboard" />

        <main className="mx-auto max-w-[100vw] px-4 py-4 sm:container sm:py-6">
          <PWAUpdatePrompt
            scriptUrl="/app-sw.js"
            scope="/"
            titleEn="New version available"
            titleAr="يتوفر إصدار جديد"
            reloadEn="Reload to update"
            reloadAr="تحديث الآن"
          />
          <OrdersPWASetup slug={slug} />
          <OrdersPushRefreshButton />
          <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:mb-6 sm:gap-4">
          <Button asChild variant="ghost" size="sm" className="shrink-0 text-slate-400 hover:text-white">
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 size-4 shrink-0" />
              Dashboard
            </Link>
          </Button>
          <span className="shrink-0 text-slate-600">/</span>
          <Button asChild variant="ghost" size="sm" className="shrink-0 text-slate-400 hover:text-white">
            <Link href={`/t/${slug}/manage`}>Manage</Link>
          </Button>
          <span className="shrink-0 text-slate-600">/</span>
          <span className="min-w-0 truncate font-medium text-white">Orders</span>
        </div>

        <TenantOrdersLive
          slug={slug}
          siteId={siteId}
          initialOrders={orders}
          initialNewOrders={newOrders}
          initialTableRequests={tableRequests}
          initialStandaloneTableRequests={standaloneTableRequests}
          initialOpenOrderId={typeof initialOpenOrderId === 'string' ? initialOpenOrderId : undefined}
          initialNotificationSound={notificationSound ?? undefined}
        />
        </main>
      </div>
    </OrdersPushGateWrapper>
  )
}
