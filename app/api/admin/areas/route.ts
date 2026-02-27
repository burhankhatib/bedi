import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

type AreaRow = {
  _id: string
  name_en: string | null
  name_ar: string | null
  deliveryPrice: number
  currency: string
  isActive: boolean
  siteRef: string
  tenantName: string | null
  tenantSlug: string | null
  city: string | null
  country: string | null
}

/** GET: List all delivery areas with tenant info (super admin only). Optional ?city= & ?tenant= for filter. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const cityFilter = (searchParams.get('city') ?? '').trim().toLowerCase()
  const tenantFilter = (searchParams.get('tenant') ?? '').trim().toLowerCase()

  const list = await client.fetch<AreaRow[]>(
    `*[_type == "area"] | order(site->city asc, name_en asc) {
      _id, name_en, name_ar, deliveryPrice, currency, isActive,
      "siteRef": site._ref,
      "tenantName": site->name,
      "tenantSlug": site->slug.current,
      "city": site->city,
      "country": site->country
    }`
  )

  let result = list ?? []
  if (cityFilter) {
    result = result.filter((a) => (a.city ?? '').toLowerCase().includes(cityFilter))
  }
  if (tenantFilter) {
    result = result.filter(
      (a) =>
        (a.tenantName ?? '').toLowerCase().includes(tenantFilter) ||
        (a.tenantSlug ?? '').toLowerCase().includes(tenantFilter)
    )
  }
  return NextResponse.json(result)
}
