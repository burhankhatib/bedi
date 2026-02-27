import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { createPayPalOrder, isPayPalOrdersEnabled } from '@/lib/paypal-server'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/subscription'

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

/**
 * POST – Create a PayPal checkout order for a one-time plan.
 * Body: { planId: '1m' | '3m' | '6m' | '12m' }
 * Returns { orderId, approveUrl }. Client should redirect to approveUrl.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isPayPalOrdersEnabled()) {
    return NextResponse.json(
      { error: 'PayPal orders not configured (PAYPAL_CLIENT_SECRET required)' },
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
    const planId = (body?.planId ?? '').trim().toLowerCase() as PlanId
    if (!planId || !SUBSCRIPTION_PLANS[planId]) {
      return NextResponse.json(
        { error: 'Invalid planId. Use one of: 1m, 3m, 6m, 12m' },
        { status: 400 }
      )
    }

    const plan = SUBSCRIPTION_PLANS[planId]
    const base = APP_BASE || req.nextUrl?.origin || 'http://localhost:3000'
    const billingPath = `/t/${slug}/manage/billing`
    const returnUrl = `${base}${billingPath}?paypal_return=1`
    const cancelUrl = `${base}${billingPath}?paypal_cancel=1`

    const { orderId, approveUrl } = await createPayPalOrder({
      planId,
      amount: String(plan.priceIls),
      currencyCode: 'ILS',
      description: plan.labelEn,
      returnUrl,
      cancelUrl,
    })

    return NextResponse.json({ orderId, approveUrl })
  } catch (e) {
    console.error('[Subscription create-order]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create order' },
      { status: 500 }
    )
  }
}
