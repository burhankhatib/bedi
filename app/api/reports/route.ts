import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantIdBySlug } from '@/lib/tenant'
import { getCategories } from '@/lib/report-categories'
import { getDriverDisplayNameForBusiness } from '@/lib/driver-display'
import { sendReportEmail } from '@/lib/report-email'
import { sendAdminNotification } from '@/lib/admin-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

type ReporterType = 'business' | 'driver' | 'customer'
type ReportedType = 'business' | 'driver' | 'customer'

/** POST: Create a report. Auth context depends on reporterType. */
export async function POST(req: NextRequest) {
  let body: {
    reporterType?: ReporterType
    reportedType?: ReportedType
    orderId?: string
    category?: string
    description?: string
    slug?: string
    trackingToken?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reporterType, reportedType, orderId, category, description, slug, trackingToken } = body

  if (!reporterType || !reportedType || !category) {
    return NextResponse.json({ error: 'Missing reporterType, reportedType, or category' }, { status: 400 })
  }

  const validPairs: [ReporterType, ReportedType][] = [
    ['business', 'driver'],
    ['business', 'customer'],
    ['driver', 'customer'],
    ['customer', 'business'],
    ['customer', 'driver'],
  ]
  if (!validPairs.some(([r, d]) => r === reporterType && d === reportedType)) {
    return NextResponse.json({ error: 'Invalid reporter/reported combination' }, { status: 400 })
  }

  const categories = getCategories(reporterType, reportedType)
  const categoryOption = categories.find((c) => c.value === category)
  if (!categoryOption) {
    return NextResponse.json({ error: 'Invalid category for this report type' }, { status: 400 })
  }

  let order: {
    _id: string
    orderNumber?: string
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string }
    customerName?: string
    customerPhone?: string
  } | null = null
  let reporterTenantId: string | undefined
  let reporterDriverId: string | undefined
  let reportedTenantId: string | undefined
  let reportedDriverId: string | undefined
  let reportedCustomerInfo: string | undefined
  let reporterInfo: string | undefined
  let reportedInfo: string | undefined

  if (reporterType === 'business') {
    if (!slug || !orderId) return NextResponse.json({ error: 'Business report requires slug and orderId' }, { status: 400 })
    const authResult = await checkTenantAuth(slug)
    if (!authResult.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    reporterTenantId = authResult.tenantId
    order = await writeClient.fetch<
      { _id: string; orderNumber?: string; site?: { _ref?: string }; assignedDriver?: { _ref?: string }; customerName?: string; customerPhone?: string } | null
    >(
      `*[_type == "order" && _id == $orderId && site._ref == $tenantId][0]{ _id, orderNumber, site, assignedDriver, customerName, customerPhone }`,
      { orderId, tenantId: authResult.tenantId }
    )
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const tenant = await writeClient.fetch(`*[_type == "tenant" && _id == $id][0]{ name }`, { id: authResult.tenantId }) as { name?: string } | null
    reporterInfo = tenant?.name ?? authResult.tenantId
    if (reportedType === 'driver' && order.assignedDriver?._ref) {
      reportedDriverId = order.assignedDriver._ref
      const driver = await writeClient.fetch(`*[_type == "driver" && _id == $id][0]{ name }`, { id: reportedDriverId }) as { name?: string } | null
      reportedInfo = driver?.name ?? reportedDriverId
    }
    if (reportedType === 'customer') {
      reportedCustomerInfo = [order.customerName, order.customerPhone].filter(Boolean).join(' · ') || undefined
      reportedInfo = reportedCustomerInfo
    }
  } else if (reporterType === 'driver') {
    if (!orderId) return NextResponse.json({ error: 'Driver report requires orderId' }, { status: 400 })
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const driver = await writeClient.fetch(`*[_type == "driver" && clerkUserId == $userId][0]{ _id, name, nickname }`, { userId }) as { _id: string; name?: string; nickname?: string } | null
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 403 })
    reporterDriverId = driver._id
    reporterInfo = getDriverDisplayNameForBusiness(driver) || driver._id
    order = await writeClient.fetch<
      { _id: string; orderNumber?: string; site?: { _ref?: string }; assignedDriver?: { _ref?: string }; customerName?: string; customerPhone?: string } | null
    >(
      `*[_type == "order" && _id == $orderId && assignedDriver._ref == $driverId][0]{ _id, orderNumber, site, assignedDriver, customerName, customerPhone }`,
      { orderId, driverId: driver._id }
    )
    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })
    reportedCustomerInfo = [order.customerName, order.customerPhone].filter(Boolean).join(' · ') || undefined
    reportedInfo = reportedCustomerInfo
  } else {
    // customer
    if (!slug || !trackingToken?.trim()) return NextResponse.json({ error: 'Customer report requires slug and trackingToken' }, { status: 400 })
    const tenantId = await getTenantIdBySlug(slug)
    if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    order = await writeClient.fetch<
      { _id: string; orderNumber?: string; site?: { _ref?: string }; assignedDriver?: { _ref?: string }; customerName?: string; customerPhone?: string } | null
    >(
      `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, orderNumber, site, assignedDriver, customerName, customerPhone }`,
      { tenantId, trackingToken: trackingToken.trim() }
    )
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    reporterInfo = order.customerName ? `Customer: ${order.customerName}` : 'Customer'
    if (reportedType === 'business') {
      reportedTenantId = order.site?._ref
      const tenant = await writeClient.fetch(`*[_type == "tenant" && _id == $id][0]{ name }`, { id: reportedTenantId }) as { name?: string } | null
      reportedInfo = tenant?.name ?? reportedTenantId
    }
    if (reportedType === 'driver' && order.assignedDriver?._ref) {
      reportedDriverId = order.assignedDriver._ref
      const driver = await writeClient.fetch(`*[_type == "driver" && _id == $id][0]{ name, nickname }`, { id: reportedDriverId }) as { name?: string; nickname?: string } | null
      reportedInfo = (driver && getDriverDisplayNameForBusiness(driver)) || reportedDriverId
    }
  }

  const reportDoc = {
    _type: 'report',
    reporterType,
    reportedType,
    order: order._id ? { _type: 'reference', _ref: order._id } : undefined,
    category,
    description: description?.trim() || undefined,
    reporterTenantId: reporterTenantId || undefined,
    reporterDriverId: reporterDriverId || undefined,
    reportedTenantId: reportedTenantId || undefined,
    reportedDriverId: reportedDriverId || undefined,
    reportedCustomerInfo: reportedCustomerInfo || undefined,
    status: 'new',
  }

  try {
    const created = await writeClient.create(reportDoc as never)
    await sendReportEmail({
      reporterType,
      reportedType,
      category: categoryOption.labelEn,
      description: description?.trim(),
      orderNumber: order.orderNumber,
      orderId: order._id,
      reporterInfo,
      reportedInfo,
    })
    const reporterLabel = { business: 'Business', driver: 'Driver', customer: 'Customer' }[reporterType]
    const reportedLabel = { business: 'Restaurant', driver: 'Driver', customer: 'Customer' }[reportedType]
    await sendAdminNotification(
      `New ${reporterLabel} → ${reportedLabel} Report`,
      `${reporterInfo ?? reporterType} reported ${reportedInfo ?? reportedType}. ${categoryOption.labelEn}${order.orderNumber ? ` — Order #${order.orderNumber}` : ''}`,
      '/admin/reports'
    )
    return NextResponse.json({ ok: true, id: created._id }, { status: 201 })
  } catch (e) {
    console.error('[reports] Create failed:', e)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}
