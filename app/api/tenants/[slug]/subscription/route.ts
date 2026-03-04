import { NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug, isTenantSubscriptionExpired } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET – Return current subscription status for the tenant (for banner and billing page). When trial/subscription has expired, sets status to past_due. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  }
  const tenant = await getTenantBySlug(slug, { useCdn: false })
  if (!tenant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let subscriptionStatus = tenant.subscriptionStatus ?? 'trial'
  if (isTenantSubscriptionExpired(tenant) && (subscriptionStatus === 'active' || subscriptionStatus === 'trial')) {
    if (token) {
      try {
        await writeClient.patch(tenant._id).set({ subscriptionStatus: 'past_due' }).commit()
      } catch (e) {
        console.warn('[subscription GET] Failed to set past_due:', e)
      }
    }
    subscriptionStatus = 'past_due'
  }

  return NextResponse.json({
    subscriptionExpiresAt: tenant.subscriptionExpiresAt ?? null,
    subscriptionStatus,
    subscriptionLastPaymentAt: tenant.subscriptionLastPaymentAt ?? null,
    paypalSubscriptionId: tenant.paypalSubscriptionId ?? null,
    createdAt: tenant.createdAt ?? null,
    businessCreatedAt: tenant.businessCreatedAt ?? null,
  })
}
