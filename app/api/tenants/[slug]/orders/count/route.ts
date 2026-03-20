import { NextRequest, NextResponse } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/** Strict: only orders belonging to this tenant. */
const siteFilter = 'site._ref == $siteId'

/** GET new orders count for tenant (lightweight for nav badge). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const siteId = auth.tenantId
  const { searchParams } = new URL(req.url)
  const refresh = searchParams.get('refresh') === '1'
  const sanityClient = refresh ? clientNoCdn : client

  try {
    const count = await sanityClient.fetch<number>(
      `count(*[_type == "order" && ${siteFilter} && status == "new"])`,
      { siteId }
    )
    return NextResponse.json(
      { newCount: typeof count === 'number' ? count : 0 },
      {
        headers: {
          'Cache-Control': refresh ? 'no-store, no-cache, must-revalidate' : 'private, max-age=15, stale-while-revalidate=30',
          Pragma: refresh ? 'no-cache' : '',
        },
      }
    )
  } catch (error) {
    console.error('[TenantOrdersCount GET]', error)
    return NextResponse.json({ newCount: 0 }, { status: 500 })
  }
}
