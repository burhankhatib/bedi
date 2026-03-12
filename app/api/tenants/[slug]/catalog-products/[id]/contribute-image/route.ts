import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Add an image to a catalog product so other tenants can use it. Body: { imageAssetId } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id: catalogProductId } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  let body: { imageAssetId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const imageAssetId = typeof body.imageAssetId === 'string' ? body.imageAssetId.trim() : null
  if (!imageAssetId) return NextResponse.json({ error: 'imageAssetId required' }, { status: 400 })

  const catalog = await writeClient.fetch<{
    _id: string
    images?: Array<{ asset?: { _ref?: string } }>
  } | null>(`*[_type == "catalogProduct" && _id == $id][0]{ _id, images }`, { id: catalogProductId })

  if (!catalog) return NextResponse.json({ error: 'Catalog product not found' }, { status: 404 })

  const current = catalog.images ?? []
  if (current.some((img) => img?.asset?._ref === imageAssetId)) {
    return NextResponse.json({ message: 'Image already in catalog' })
  }

  const newImages = [
    ...current.map((img) => ({ _type: 'image' as const, asset: { _type: 'reference' as const, _ref: img!.asset!._ref } })),
    { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: imageAssetId } },
  ]
  await writeClient.patch(catalogProductId).set({ images: newImages }).commit()
  return NextResponse.json({ ok: true })
}
