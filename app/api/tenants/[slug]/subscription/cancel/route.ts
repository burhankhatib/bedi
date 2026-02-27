import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { cancelPayPalSubscription, isPayPalOrdersEnabled } from '@/lib/paypal-server'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST – Cancel the tenant's PayPal recurring subscription.
 * Tenant keeps access until subscriptionExpiresAt; no further charges.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isPayPalOrdersEnabled()) {
    return NextResponse.json(
      { error: 'PayPal not configured' },
      { status: 503 }
    )
  }
  try {
    const { slug } = await params
    const auth = await checkTenantAuth(slug)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
    }

    const tenant = await getTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const subscriptionId = tenant.paypalSubscriptionId?.trim()
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No PayPal subscription to cancel' },
        { status: 400 }
      )
    }

    await cancelPayPalSubscription(subscriptionId)

    await writeClient
      .patch(tenant._id)
      .set({ subscriptionStatus: 'cancelled' })
      .commit()

    return NextResponse.json({
      ok: true,
      message: 'Subscription cancelled. You can use the platform until your current period ends.',
    })
  } catch (e) {
    console.error('[Subscription cancel]', e)
    const message = e instanceof Error ? e.message : 'Failed to cancel subscription'
    const status = message.includes('not found') || message.includes('already cancelled') ? 400 : 500
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
