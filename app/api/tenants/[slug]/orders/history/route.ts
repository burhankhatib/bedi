import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

const siteFilter = '(site._ref == $siteId || !defined(site))'
const noCacheClient = client.withConfig({ useCdn: false })
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
  assignedDriver->{
    _id,
    name,
    phoneNumber,
    deliveryAreas[]->{_id, name_en, name_ar}
  },
  items,
  subtotal,
  totalAmount,
  currency,
  createdAt,
  completedAt
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

  try {
    const orders = (await noCacheClient.fetch(ORDERS_GROQ, { siteId })) ?? []
    let filtered = orders as Array<{
      _id: string
      orderNumber?: string
      customerName?: string
      customerPhone?: string
      [key: string]: unknown
    }>
    if (q) {
      filtered = filtered.filter((o) => {
        const num = String(o.orderNumber ?? '').toLowerCase()
        const name = String(o.customerName ?? '').toLowerCase()
        const phone = String(o.customerPhone ?? '').replace(/\s/g, '')
        const qNorm = q.replace(/\s/g, '')
        return num.includes(q) || name.includes(q) || phone.includes(qNorm)
      })
    }
    return NextResponse.json(
      { orders: filtered },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[TenantOrdersHistory GET]', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
