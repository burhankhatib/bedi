import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { slugify, ensureUniqueSlug } from '@/lib/slugify'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const readClient = refresh ? writeClient : client

  const list = await readClient.fetch<
    Array<{ _id: string; title_en: string; title_ar: string; slug: { current: string }; sortOrder?: number; productSortMode?: string }>
  >(
    `*[_type == "category" && site._ref == $siteId] | order(sortOrder asc) { _id, title_en, title_ar, "slug": slug.current, sortOrder, productSortMode }`,
    { siteId: auth.tenantId }
  )
  return NextResponse.json(list || [], {
    headers: refresh ? { 'Cache-Control': 'no-store' } : { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const { title_en, title_ar, slug: slugInput, sortOrder, subcategoryRef } = body as {
    title_en?: string
    title_ar?: string
    slug?: string
    sortOrder?: number
    subcategoryRef?: string
  }
  if (!title_en || !title_ar) {
    return NextResponse.json({ error: 'title_en and title_ar required' }, { status: 400 })
  }

  const baseSlug = slugify(typeof slugInput === 'string' && slugInput.trim() ? slugInput : title_en)
  const slugValue = await ensureUniqueSlug(baseSlug || 'category', async (s) => {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "category" && site._ref == $siteId && slug.current == $slug][0]{ _id }`,
      { siteId: auth.tenantId, slug: s }
    )
    return !!existing
  })

  const doc = await writeClient.create({
    _type: 'category',
    site: { _type: 'reference', _ref: auth.tenantId },
    title_en,
    title_ar,
    slug: { _type: 'slug', current: slugValue },
    sortOrder: sortOrder ?? 0,
    ...(subcategoryRef && typeof subcategoryRef === 'string' && subcategoryRef.trim()
      ? { subcategoryRef: { _type: 'reference', _ref: subcategoryRef.trim() } }
      : {}),
  })
  return NextResponse.json({ _id: doc._id, title_en, title_ar, slug: slugValue, sortOrder: doc.sortOrder })
}
