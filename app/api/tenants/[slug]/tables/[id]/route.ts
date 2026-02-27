import { NextRequest, NextResponse } from 'next/server'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { clientNoCdn } from '@/sanity/lib/client'

const writeClient = clientNoCdn.withConfig({ token: token || undefined, useCdn: false })

/** DELETE a table. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const doc = await writeClient.fetch<{ _id: string; siteRef: string } | null>(
    `*[_type == "tenantTable" && _id == $id][0]{ _id, "siteRef": site._ref }`,
    { id }
  )
  if (!doc || doc.siteRef !== auth.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
