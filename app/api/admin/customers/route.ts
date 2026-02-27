import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

/** GET: List customers (super admin only). ?search=… filters by name, primaryPhone, email. Returns enriched data: businesses, orderCount, totalSpent, recentOrders. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') ?? '').trim().toLowerCase()
  const dateJoinedFrom = searchParams.get('date_joined_from')?.trim() || null
  const dateJoinedTo = searchParams.get('date_joined_to')?.trim() || null
  const blockStatus = (searchParams.get('block_status') ?? 'all').toLowerCase()
  const citiesParam = searchParams.get('cities')?.trim()
  const filterCities = citiesParam ? citiesParam.split(',').map((s) => s.trim()).filter(Boolean) : null

  const customers = await freshClient.fetch<
    Array<{
      _id: string
      name?: string
      primaryPhone?: string
      email?: string
      firstOrderAt?: string
      lastOrderAt?: string
      orderCount?: number
      blockedBySuperAdmin?: boolean
    }>
  >(
    `*[_type == "customer"] | order(name asc) {
      _id,
      name,
      primaryPhone,
      email,
      firstOrderAt,
      lastOrderAt,
      orderCount,
      blockedBySuperAdmin
    }`
  )

  let list = customers ?? []
  if (search.length >= 1) {
    list = list.filter((c) => {
      const n = (c.name ?? '').toLowerCase()
      const p = (c.primaryPhone ?? '').toLowerCase().replace(/\s/g, '')
      const e = (c.email ?? '').toLowerCase()
      const q = search.replace(/\s/g, '')
      return n.includes(search) || p.includes(q) || e.includes(search)
    })
  }

  if (blockStatus === 'blocked') list = list.filter((c) => c.blockedBySuperAdmin === true)
  else if (blockStatus === 'active') list = list.filter((c) => c.blockedBySuperAdmin !== true)

  if (dateJoinedFrom || dateJoinedTo) {
    list = list.filter((c) => {
      const first = c.firstOrderAt ? new Date(c.firstOrderAt).getTime() : null
      if (first == null) return false
      if (dateJoinedFrom) {
        const from = new Date(dateJoinedFrom + 'T00:00:00.000Z').getTime()
        if (first < from) return false
      }
      if (dateJoinedTo) {
        const to = new Date(dateJoinedTo + 'T23:59:59.999Z').getTime()
        if (first > to) return false
      }
      return true
    })
  }

  const customerIds = list.map((c) => c._id)
  if (customerIds.length === 0) {
    return NextResponse.json({
      customers: list.map((c) => ({
        ...c,
        totalSpent: 0,
        totalSpentCurrency: 'ILS',
        businesses: [] as string[],
        businessSpend: [] as Array<{ businessName: string; city?: string; totalSpent: number; orderCount: number }>,
        customerCities: [] as string[],
        recentOrders: [] as Array<{ orderNumber?: string; siteName?: string; totalAmount?: number; currency?: string; status?: string; createdAt?: string }>,
      })),
      availableCities: [] as string[],
    })
  }

  const orders = await freshClient.fetch<
    Array<{
      customerId: string
      orderNumber?: string
      totalAmount?: number
      currency?: string
      status?: string
      createdAt?: string
      siteName?: string
      siteCity?: string
    }>
  >(
    `*[_type == "order" && defined(customer) && customer._ref in $customerIds] | order(createdAt desc) {
      "customerId": customer._ref,
      orderNumber,
      totalAmount,
      currency,
      status,
      createdAt,
      "siteName": site->name,
      "siteCity": site->city
    }`,
    { customerIds }
  )

  const orderList = orders ?? []
  const allCities = new Set<string>()
  const byCustomer: Record<
    string,
    {
      totalSpent: number
      currency: string
      businesses: Set<string>
      byBusiness: Map<string, { city?: string; totalSpent: number; orderCount: number }>
      cities: Set<string>
      recentOrders: Array<{ orderNumber?: string; siteName?: string; totalAmount?: number; currency?: string; status?: string; createdAt?: string }>
    }
  > = {}
  customerIds.forEach((id) => {
    byCustomer[id] = {
      totalSpent: 0,
      currency: 'ILS',
      businesses: new Set(),
      byBusiness: new Map(),
      cities: new Set(),
      recentOrders: [],
    }
  })
  orderList.forEach((o) => {
    const c = byCustomer[o.customerId]
    if (!c) return
    const amount = typeof o.totalAmount === 'number' ? o.totalAmount : 0
    c.totalSpent += amount
    if (o.currency) c.currency = o.currency
    const bName = o.siteName ?? '—'
    if (o.siteName) c.businesses.add(o.siteName)
    if (o.siteCity) {
      c.cities.add(o.siteCity)
      allCities.add(o.siteCity)
    }
    const key = `${bName}|${o.siteCity ?? ''}`
    const existing = c.byBusiness.get(key)
    if (existing) {
      existing.totalSpent += amount
      existing.orderCount += 1
    } else {
      c.byBusiness.set(key, { city: o.siteCity, totalSpent: amount, orderCount: 1 })
    }
    if (c.recentOrders.length < 10)
      c.recentOrders.push({
        orderNumber: o.orderNumber,
        siteName: o.siteName,
        totalAmount: o.totalAmount,
        currency: o.currency,
        status: o.status,
        createdAt: o.createdAt,
      })
  })

  let enriched = list.map((c) => {
    const agg = byCustomer[c._id]
    const byBusinessEntries = agg ? Array.from(agg.byBusiness.entries()) : []
    const businessSpendArray = byBusinessEntries.map(([k, v]) => {
      const [businessName] = k.split('|')
      return { businessName: businessName || '—', city: v.city, totalSpent: v.totalSpent, orderCount: v.orderCount }
    })
    return {
      ...c,
      totalSpent: agg ? agg.totalSpent : 0,
      totalSpentCurrency: agg?.currency ?? 'ILS',
      businesses: agg ? Array.from(agg.businesses) : [],
      businessSpend: businessSpendArray,
      customerCities: agg ? Array.from(agg.cities) : [],
      recentOrders: agg?.recentOrders ?? [],
    }
  })

  if (filterCities && filterCities.length > 0) {
    enriched = enriched.filter((c) => c.customerCities.some((city) => filterCities.includes(city)))
  }

  const availableCities = Array.from(allCities).sort((a, b) => a.localeCompare(b))

  return NextResponse.json({ customers: enriched, availableCities })
}
