import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/** GET: List catalog categories for filtering the product catalog. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const list = await client.fetch<
    Array<{ _id: string; title_en: string; title_ar: string; slug: string }>
  >(
    `*[_type == "catalogCategory"] | order(sortOrder asc, title_en asc) { _id, title_en, title_ar, "slug": slug.current }`
  )

  return NextResponse.json(list ?? [], { headers: { 'Cache-Control': 'private, max-age=300' } })
}
