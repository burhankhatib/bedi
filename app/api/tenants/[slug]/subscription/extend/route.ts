import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { SUBSCRIPTION_PLANS, addMonthsToDate, type PlanId } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST – Extend subscription by plan (after tenant pays via PayPal).
 * Body: { plan: '1m' | '3m' | '6m' | '12m' }
 * Sets subscriptionExpiresAt to (current expiry or now) + plan months; sets subscriptionStatus to 'active'.
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
    const plan = (body?.plan ?? '').trim().toLowerCase() as PlanId
    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan. Use one of: 1m, 3m, 6m, 12m' },
        { status: 400 }
      )
    }

    const tenant = await getTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const from = tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) > new Date()
      ? new Date(tenant.subscriptionExpiresAt)
      : new Date()
    const months = SUBSCRIPTION_PLANS[plan].months
    const newExpiresAt = addMonthsToDate(from, months)

    await writeClient.patch(tenant._id).set({
      subscriptionExpiresAt: newExpiresAt.toISOString(),
      subscriptionStatus: 'active',
    }).commit()

    return NextResponse.json({
      ok: true,
      subscriptionExpiresAt: newExpiresAt.toISOString(),
      plan,
      monthsAdded: months,
    })
  } catch (e) {
    console.error('[Subscription extend]', e)
    return NextResponse.json({ error: 'Failed to extend subscription' }, { status: 500 })
  }
}
