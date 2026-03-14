/**
 * GET /api/tenants/[slug]/next-opening
 * Returns the next opening datetime for this business (ISO string).
 * Used when tenant marks a product unavailable "until next opening".
 */
import { NextRequest } from 'next/server'
import { getNextOpeningForTenant } from '@/lib/next-opening-for-tenant'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) {
      return Response.json({ error: 'Slug required' }, { status: 400 })
    }

    const nextOpenAt = await getNextOpeningForTenant(slug)

    return Response.json({
      nextOpenAt,
      messageEn: nextOpenAt ? `Available again at ${new Date(nextOpenAt).toLocaleString('en')}` : null,
      messageAr: nextOpenAt ? `متوفر مرة أخرى في ${new Date(nextOpenAt).toLocaleString('ar')}` : null,
    })
  } catch (e) {
    console.error('[next-opening]', e)
    return Response.json({ error: 'Failed to compute next opening' }, { status: 500 })
  }
}
