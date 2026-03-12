import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug } from '@/lib/tenant'
import { isBOPConfigured, buildBOPInternalReference, getBOPApiSecret } from '@/lib/bop-payments'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/subscription'

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/**
 * POST – Create a Bank of Palestine payment for a one-time plan.
 * Body: { planId: '1m' | '3m' | '6m' | '12m' }
 *
 * Returns { paymentUrl, internalReference } for redirect, or { error }.
 *
 * The BOP API base URL can be set via BOP_PAYMENTS_API_URL (e.g. https://api.bop.ps or sandbox).
 * Configure Test Callback URL and Test Webhook URL in your BOP dashboard to point to:
 *   - Callback: https://your-domain/api/bop/callback
 *   - Webhook: https://your-domain/api/bop/webhook
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isBOPConfigured()) {
    return NextResponse.json(
      { error: 'Bank of Palestine payments not configured (BOP_PAYMENTS_API_KEY and BOP_PAYMENTS_API_SECRET required)' },
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

    const tenant = await getTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const plan = SUBSCRIPTION_PLANS[planId]
    const internalReference = buildBOPInternalReference(slug, planId)
    const callbackUrl = `${APP_BASE}/api/bop/callback`
    const successUrl = `${callbackUrl}?internalReference=${encodeURIComponent(internalReference)}`
    const cancelUrl = `${APP_BASE}/t/${slug}/manage/billing?bop_return=cancelled`

    // Try BOP Payment API – adapt to your BOP product's exact API
    const apiBase = process.env.BOP_PAYMENTS_API_URL?.trim() || 'https://api.bop.ps'
    const createPayload = {
      amount: plan.priceIls * 100, // or in minor units if required
      currency: 'ILS',
      successUrl,
      cancelUrl,
      failureUrl: cancelUrl,
      metadata: { internalReference },
      internalReference,
    }

    const secret = getBOPApiSecret()
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(createPayload),
    }).catch((e) => {
      console.warn('[BOP create-payment] API call failed:', e)
      return null
    })

    if (res?.ok) {
      const data = await res.json().catch(() => ({}))
      const paymentUrl = data.url ?? data.payment_url ?? data.checkout_url ?? data.redirect_url
      if (typeof paymentUrl === 'string' && paymentUrl.startsWith('http')) {
        return NextResponse.json({
          paymentUrl,
          internalReference,
          orderId: data.id ?? data.payment_id,
        })
      }
    }

    // Fallback: return manual payment info – BOP may use a different API format
    // User can configure their BOP dashboard to use our callback URL.
    // For now, return instructions for manual/alternative flow.
    return NextResponse.json({
      manual: true,
      internalReference,
      amount: plan.priceIls,
      currency: 'ILS',
      callbackUrl,
      webhookUrl: `${APP_BASE}/api/bop/webhook`,
      message: 'BOP API format may differ. Configure your BOP product to pass internalReference in callback/webhook. Use the QR or contact support for payment link.',
    })
  } catch (e) {
    console.error('[BOP create-payment]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create payment' },
      { status: 500 }
    )
  }
}
