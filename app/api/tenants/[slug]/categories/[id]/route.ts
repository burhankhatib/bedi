import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { slugify, ensureUniqueSlug } from '@/lib/slugify'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function checkCategoryOwnership(slug: string, id: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { auth: null as never, doc: null }
  const doc = await client.fetch<{ _id: string; site: { _ref: string } } | null>(
    `*[_type == "category" && _id == $id][0]{ _id, site }`,
    { id }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { auth, doc: null }
  return { auth, doc }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkCategoryOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (body.title_en != null) patch.title_en = body.title_en
  if (body.title_ar != null) patch.title_ar = body.title_ar
  if (body.sortOrder != null) patch.sortOrder = body.sortOrder
  if (body.slug != null) {
    const baseSlug = slugify(body.slug)
    if (baseSlug) {
      const slugValue = await ensureUniqueSlug(baseSlug, async (s) => {
        const existing = await client.fetch<{ _id: string } | null>(
          `*[_type == "category" && site._ref == $siteId && slug.current == $slug && _id != $id][0]{ _id }`,
          { siteId: auth.tenantId, slug: s, id }
        )
        return !!existing
      })
      patch.slug = { _type: 'slug', current: slugValue }
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  await writeClient.patch(id).set(patch).commit()
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const { auth, doc } = await checkCategoryOwnership(slug, id)
  if (!auth?.ok || !doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  await writeClient.delete(id)
  return NextResponse.json({ ok: true })
}
