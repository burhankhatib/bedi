import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/** Strict: only orders belonging to this tenant. */
const siteFilter = 'site._ref == $siteId'
const noCacheClient = client.withConfig({ useCdn: false })

/** GET new orders count for tenant (lightweight for nav badge). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const siteId = auth.tenantId
  try {
    const count = await noCacheClient.fetch<number>(
      `count(*[_type == "order" && ${siteFilter} && status == "new"])`,
      { siteId }
    )
    return NextResponse.json(
      { newCount: typeof count === 'number' ? count : 0 },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('[TenantOrdersCount GET]', error)
    return NextResponse.json({ newCount: 0 }, { status: 500 })
  }
}
