import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

type Row = {
  _id: string
  type: string
  clerkUserId?: string
  name?: string
  email: string
  message?: string
  createdAt?: string
}

/** GET: List suspended account contact submissions (super admin only). Resolves driver/tenant/customer when clerkUserId present. */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const list = await freshClient.fetch<Row[]>(
    `*[_type == "suspendedContact"] | order(createdAt desc) {
      _id,
      type,
      clerkUserId,
      name,
      email,
      message,
      createdAt
    }`
  )
  const rows = list ?? []

  const withClerk = rows.filter((r) => r.clerkUserId)
  const clerkIds = [...new Set(withClerk.map((r) => r.clerkUserId as string))]

  const [drivers, tenants, customers] = await Promise.all([
    clerkIds.length
      ? freshClient.fetch<Array<{ _id: string; clerkUserId?: string; phoneNumber?: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "driver" && clerkUserId in $ids]{ _id, clerkUserId, phoneNumber, blockedBySuperAdmin }`,
          { ids: clerkIds }
        )
      : Promise.resolve([]),
    clerkIds.length
      ? freshClient.fetch<Array<{ _id: string; clerkUserId?: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "tenant" && clerkUserId in $ids]{ _id, clerkUserId, blockedBySuperAdmin }`,
          { ids: clerkIds }
        )
      : Promise.resolve([]),
    clerkIds.length
      ? freshClient.fetch<Array<{ _id: string; clerkUserId?: string; primaryPhone?: string; blockedBySuperAdmin?: boolean }>>(
          `*[_type == "customer" && clerkUserId in $ids]{ _id, clerkUserId, primaryPhone, blockedBySuperAdmin }`,
          { ids: clerkIds }
        )
      : Promise.resolve([]),
  ])

  const tenantIds = (tenants ?? []).map((t) => t._id)
  const tenantPhones = await (tenantIds.length
    ? freshClient.fetch<Array<{ tenantId: string; phone: string | null }>>(
        `*[_type == "restaurantInfo" && site._ref in $ids]{ "tenantId": site._ref, "phone": socials.whatsapp }`,
        { ids: tenantIds }
      )
    : Promise.resolve([]))

  type Resolved = { id: string; phone: string | null; blocked: boolean }
  const driverByClerk = new Map<string, Resolved>()
  ;(drivers ?? []).forEach((d) => {
    if (d.clerkUserId)
      driverByClerk.set(d.clerkUserId, {
        id: d._id,
        phone: d.phoneNumber ?? null,
        blocked: d.blockedBySuperAdmin === true,
      })
  })
  const tenantByClerk = new Map<string, Resolved>()
  const phoneByTenantId = new Map<string, string>()
  ;(tenantPhones ?? []).forEach((t) => {
    if (t.phone) phoneByTenantId.set(t.tenantId, t.phone)
  })
  ;(tenants ?? []).forEach((t) => {
    if (t.clerkUserId)
      tenantByClerk.set(t.clerkUserId, {
        id: t._id,
        phone: phoneByTenantId.get(t._id) ?? null,
        blocked: t.blockedBySuperAdmin === true,
      })
  })
  const customerByClerk = new Map<string, Resolved>()
  ;(customers ?? []).forEach((c) => {
    if (c.clerkUserId)
      customerByClerk.set(c.clerkUserId, {
        id: c._id,
        phone: c.primaryPhone ?? null,
        blocked: c.blockedBySuperAdmin === true,
      })
  })

  const contacts = rows.map((r) => {
    let resolved: Resolved | null = null
    if (r.clerkUserId) {
      if (r.type === 'driver') resolved = driverByClerk.get(r.clerkUserId) ?? null
      if (r.type === 'business') resolved = tenantByClerk.get(r.clerkUserId) ?? null
      if (r.type === 'customer') resolved = customerByClerk.get(r.clerkUserId) ?? null
    }
    return {
      _id: r._id,
      type: r.type,
      name: r.name ?? null,
      email: r.email,
      message: r.message ?? null,
      createdAt: r.createdAt ?? null,
      resolved,
    }
  })

  return NextResponse.json({ contacts })
}
