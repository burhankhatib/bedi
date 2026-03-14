import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import {
  capturePayPalOrder,
  getPayPalOrder,
  isPayPalOrdersEnabled,
} from '@/lib/paypal-server'
import { SUBSCRIPTION_PLANS, addMonthsToDate, type PlanId } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST – Capture a PayPal order and extend subscription by the plan in custom_id.
 * Body: { orderId: string }
 * Returns { ok, subscriptionExpiresAt, plan }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isPayPalOrdersEnabled()) {
    return NextResponse.json(
      { error: 'PayPal orders not configured' },
      { status: 503 }
    )
  }
  try {
    const { slug } = await params
    const auth = await checkTenantAuth(slug)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
    }

    const body = await req.json().catch(() => ({}))
    const orderId = (body?.orderId ?? '').trim()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const capture = await capturePayPalOrder(orderId)
    let planId = (capture.customId?.trim().toLowerCase() ?? '') as PlanId
    if (!planId || !SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]) {
      const order = await getPayPalOrder(orderId)
      planId = (order.custom_id?.trim().toLowerCase() ?? '') as PlanId
    }
    const planDef = planId ? SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS] : null
    if (!planId || !planDef) {
      return NextResponse.json(
        { error: 'Could not determine plan from order' },
        { status: 400 }
      )
    }

    const tenant = await getTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const from =
      tenant.subscriptionExpiresAt &&
      new Date(tenant.subscriptionExpiresAt) > new Date()
        ? new Date(tenant.subscriptionExpiresAt)
        : new Date()
    const months = planDef.months
    const newExpiresAt = addMonthsToDate(from, months)

    await writeClient
      .patch(tenant._id)
      .set({
        subscriptionExpiresAt: newExpiresAt.toISOString(),
        subscriptionStatus: 'active',
        subscriptionPlan: planDef.tier,
        subscriptionLastPaymentAt: new Date().toISOString(),
      })
      .commit()

    return NextResponse.json({
      ok: true,
      subscriptionExpiresAt: newExpiresAt.toISOString(),
      plan: planId,
      monthsAdded: months,
      subscriptionPlan: planDef.tier,
    })
  } catch (e) {
    console.error('[Subscription capture-order]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to capture order' },
      { status: 500 }
    )
  }
}
