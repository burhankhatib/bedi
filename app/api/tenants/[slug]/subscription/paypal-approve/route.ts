import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { addMonthsToDate } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST – Called after tenant approves a PayPal recurring subscription.
 * Body: { subscriptionID: string }
 * Extends subscription by 1 month (first billing period) and stores the subscription ID for future webhook renewals.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await checkTenantAuth(slug)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
    }

    const body = await req.json().catch(() => ({}))
    const subscriptionID = typeof body?.subscriptionID === 'string' ? body.subscriptionID.trim() : ''
    if (!subscriptionID) {
      return NextResponse.json(
        { error: 'Missing subscriptionID' },
        { status: 400 }
      )
    }

    const tenant = await getTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const from =
      tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) > new Date()
        ? new Date(tenant.subscriptionExpiresAt)
        : new Date()
    const newExpiresAt = addMonthsToDate(from, 1)
    const nowIso = new Date().toISOString()

    await writeClient
      .patch(tenant._id)
      .set({
        subscriptionExpiresAt: newExpiresAt.toISOString(),
        subscriptionStatus: 'active',
        paypalSubscriptionId: subscriptionID,
        subscriptionLastPaymentAt: nowIso,
      })
      .commit()

    return NextResponse.json({
      ok: true,
      subscriptionExpiresAt: newExpiresAt.toISOString(),
      subscriptionLastPaymentAt: nowIso,
      subscriptionID,
    })
  } catch (e) {
    console.error('[PayPal subscription approve]', e)
    return NextResponse.json(
      { error: 'Failed to activate subscription' },
      { status: 500 }
    )
  }
}
