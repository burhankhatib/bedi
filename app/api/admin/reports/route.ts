import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

type ReportRow = {
  _id: string
  _createdAt: string
  reporterType?: string
  reportedType?: string
  category?: string
  description?: string
  status?: string
  archived?: boolean
  orderNumber?: string
  reporterTenantId?: string
  reporterDriverId?: string
  reportedTenantId?: string
  reportedDriverId?: string
  reportedCustomerInfo?: string
  orderCustomerId?: string
  orderCustomerPhone?: string
}

/** GET: List reports (super admin only). ?archived=1 for archived only, otherwise non-archived. Returns phones and report counts. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'new'

  let reportCondition = ''
  if (filter === 'new') {
    reportCondition = `(!defined(status) || status == 'new') && (!defined(archived) || archived == false)`
  } else if (filter === 'read') {
    reportCondition = `status == 'read' && (!defined(archived) || archived == false)`
  } else if (filter === 'archived') {
    reportCondition = `archived == true`
  }

  const reports = await freshClient.fetch<ReportRow[]>(
    `*[_type == "report" && ${reportCondition}] | order(_createdAt desc) {
      _id,
      _createdAt,
      reporterType,
      reportedType,
      category,
      description,
      status,
      archived,
      "orderId": order->_id,
      "orderNumber": order->orderNumber,
      reporterTenantId,
      reporterDriverId,
      reportedTenantId,
      reportedDriverId,
      reportedCustomerInfo,
      "orderCustomerId": order->customer._ref,
      "orderCustomerPhone": order->customerPhone
    }`
  )

  const list = reports ?? []

  const tenantIds = new Set<string>()
  const driverIds = new Set<string>()
  list.forEach((r) => {
    if (r.reporterTenantId) tenantIds.add(r.reporterTenantId)
    if (r.reportedTenantId) tenantIds.add(r.reportedTenantId)
    if (r.reporterDriverId) driverIds.add(r.reporterDriverId)
    if (r.reportedDriverId) driverIds.add(r.reportedDriverId)
  })

  const tenantIdList = Array.from(tenantIds)
  const driverIdList = Array.from(driverIds)

  const [tenantPhones, driverPhones] = await Promise.all([
    tenantIdList.length
      ? freshClient.fetch<Array<{ tenantId: string; phone: string | null }>>(
          `*[_type == "restaurantInfo" && site._ref in $ids]{ "tenantId": site._ref, "phone": socials.whatsapp }`,
          { ids: tenantIdList }
        )
      : Promise.resolve([]),
    driverIdList.length
      ? freshClient.fetch<Array<{ _id: string; phoneNumber: string | null }>>(
          `*[_type == "driver" && _id in $ids]{ _id, phoneNumber }`,
          { ids: driverIdList }
        )
      : Promise.resolve([]),
  ])

  const tenantPhoneMap = new Map<string, string>()
  ;(tenantPhones ?? []).forEach((t) => {
    if (t.phone) tenantPhoneMap.set(t.tenantId, t.phone)
  })
  const driverPhoneMap = new Map<string, string>()
  ;(driverPhones ?? []).forEach((d) => {
    if (d.phoneNumber) driverPhoneMap.set(d._id, d.phoneNumber)
  })

  const customerIds = [...new Set(list.filter((r) => r.reportedType === 'customer' && r.orderCustomerId).map((r) => r.orderCustomerId as string))]
  const [tenantBlocked, driverBlocked, customerBlocked] = await Promise.all([
    tenantIdList.length
      ? freshClient.fetch<Array<{ _id: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "tenant" && _id in $ids]{ _id, blockedBySuperAdmin }`,
          { ids: tenantIdList }
        )
      : Promise.resolve([]),
    driverIdList.length
      ? freshClient.fetch<Array<{ _id: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "driver" && _id in $ids]{ _id, blockedBySuperAdmin }`,
          { ids: driverIdList }
        )
      : Promise.resolve([]),
    customerIds.length
      ? freshClient.fetch<Array<{ _id: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "customer" && _id in $ids]{ _id, blockedBySuperAdmin }`,
          { ids: customerIds }
        )
      : Promise.resolve([]),
  ])
  const blocked = (arr: Array<{ _id: string; blockedBySuperAdmin?: boolean }>) => {
    const m = new Map<string, boolean>()
    ;(arr ?? []).forEach((x) => m.set(x._id, x.blockedBySuperAdmin === true))
    return m
  }
  const tenantBlockedMap = blocked(tenantBlocked ?? [])
  const driverBlockedMap = blocked(driverBlocked ?? [])
  const customerBlockedMap = blocked(customerBlocked ?? [])

  const reportsWithPhones = list.map((r) => {
    let reporterPhone: string | undefined
    let reportedPhone: string | undefined
    if (r.reporterType === 'business' && r.reporterTenantId)
      reporterPhone = tenantPhoneMap.get(r.reporterTenantId)
    if (r.reporterType === 'driver' && r.reporterDriverId)
      reporterPhone = driverPhoneMap.get(r.reporterDriverId)
    if (r.reportedType === 'business' && r.reportedTenantId)
      reportedPhone = tenantPhoneMap.get(r.reportedTenantId)
    if (r.reportedType === 'driver' && r.reportedDriverId)
      reportedPhone = driverPhoneMap.get(r.reportedDriverId)
    if (r.reportedType === 'customer')
      reportedPhone = r.orderCustomerPhone || (r.reportedCustomerInfo ?? undefined)
    if (r.reporterType === 'customer') reporterPhone = r.orderCustomerPhone ?? undefined

    let reportedBlocked: boolean | null = null
    let reporterBlocked: boolean | null = null
    if (r.reportedType === 'business' && r.reportedTenantId) reportedBlocked = tenantBlockedMap.get(r.reportedTenantId) ?? null
    if (r.reportedType === 'driver' && r.reportedDriverId) reportedBlocked = driverBlockedMap.get(r.reportedDriverId) ?? null
    if (r.reportedType === 'customer' && r.orderCustomerId) reportedBlocked = customerBlockedMap.get(r.orderCustomerId) ?? null
    if (r.reporterType === 'business' && r.reporterTenantId) reporterBlocked = tenantBlockedMap.get(r.reporterTenantId) ?? null
    if (r.reporterType === 'driver' && r.reporterDriverId) reporterBlocked = driverBlockedMap.get(r.reporterDriverId) ?? null

    return {
      ...r,
      reporterPhone: reporterPhone || null,
      reportedPhone: reportedPhone || null,
      reportedCustomerId: r.orderCustomerId || null,
      reportedBlocked: reportedBlocked ?? false,
      reporterBlocked: reporterBlocked ?? false,
    }
  })

  const allForCounts = await freshClient.fetch<
    Array<{
      reportedTenantId?: string
      reportedDriverId?: string
      reportedCustomerInfo?: string
      orderCustomerId?: string
    }>
  >(
    `*[_type == "report"]{ reportedTenantId, reportedDriverId, reportedCustomerInfo, "orderCustomerId": order->customer._ref }`
  )

  let driverCondition = `isVerifiedByAdmin != true`
  if (filter === 'new') {
    driverCondition += ` && (!defined(pendingTaskStatus) || pendingTaskStatus == 'new') && (!defined(pendingTaskArchived) || pendingTaskArchived == false)`
  } else if (filter === 'read') {
    driverCondition += ` && pendingTaskStatus == 'read' && (!defined(pendingTaskArchived) || pendingTaskArchived == false)`
  } else if (filter === 'archived') {
    driverCondition += ` && pendingTaskArchived == true`
  }

  const pendingDrivers = await freshClient.fetch<
    Array<{
      _id: string
      name?: string
      phoneNumber?: string
      country?: string
      city?: string
      _createdAt: string
    }>
  >(
    `*[_type == "driver" && ${driverCondition}] | order(_createdAt desc) {
      _id, name, phoneNumber, country, city, _createdAt
    }`
  )

  const countTenant: Record<string, number> = {}
  const countDriver: Record<string, number> = {}
  const countCustomer: Record<string, number> = {}
  ;(allForCounts ?? []).forEach((row) => {
    if (row.reportedTenantId) {
      countTenant[row.reportedTenantId] = (countTenant[row.reportedTenantId] ?? 0) + 1
    }
    if (row.reportedDriverId) {
      countDriver[row.reportedDriverId] = (countDriver[row.reportedDriverId] ?? 0) + 1
    }
    const customerKey = row.orderCustomerId || row.reportedCustomerInfo || ''
    if (customerKey) {
      countCustomer[customerKey] = (countCustomer[customerKey] ?? 0) + 1
    }
  })

  return NextResponse.json({
    reports: reportsWithPhones,
    reportCounts: { tenant: countTenant, driver: countDriver, customer: countCustomer },
    pendingDrivers: pendingDrivers ?? [],
  })
}
