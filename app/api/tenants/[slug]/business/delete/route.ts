import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * DELETE: Permanently delete the tenant and all related documents from Sanity.
 * Requires tenant auth. Double-confirmation is done in the UI (user must type business name).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const siteId = auth.tenantId

  try {
    // Fetch all document IDs that reference this tenant (order: children first, then tenant)
    const [
      restaurantInfoIds,
      areaIds,
      categoryIds,
      productIds,
      tenantDriverIds,
      orderIds,
    ] = await Promise.all([
      client.fetch<string[]>(`*[_type == "restaurantInfo" && site._ref == $siteId]._id`, { siteId }),
      client.fetch<string[]>(`*[_type == "area" && site._ref == $siteId]._id`, { siteId }),
      client.fetch<string[]>(`*[_type == "category" && site._ref == $siteId]._id`, { siteId }),
      client.fetch<string[]>(`*[_type == "product" && site._ref == $siteId]._id`, { siteId }),
      client.fetch<string[]>(`*[_type == "tenantDriver" && site._ref == $siteId]._id`, { siteId }),
      client.fetch<string[]>(`*[_type == "order" && site._ref == $siteId]._id`, { siteId }),
    ])

    const idsToDelete = [
      ...(restaurantInfoIds ?? []),
      ...(areaIds ?? []),
      ...(categoryIds ?? []),
      ...(productIds ?? []),
      ...(tenantDriverIds ?? []),
      ...(orderIds ?? []),
      siteId,
    ]

    // Delete in a single transaction (Sanity supports multiple mutations)
    const tx = writeClient.transaction()
    for (const id of idsToDelete) {
      tx.delete(id)
    }
    await tx.commit()

    return NextResponse.json({ ok: true, deleted: idsToDelete.length })
  } catch (err) {
    console.error('[DELETE tenant]', err)
    return NextResponse.json(
      { error: 'Failed to delete business. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
