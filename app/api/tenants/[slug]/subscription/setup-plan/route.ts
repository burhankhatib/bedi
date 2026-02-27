import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import {
  createPayPalCatalogProduct,
  createPayPalBillingPlan,
  isPayPalOrdersEnabled,
} from '@/lib/paypal-server'

const SUBSCRIPTION_MONTHLY_PRICE_ILS = 300
const PRODUCT_NAME = 'Zonify Business Subscription'
const PRODUCT_DESCRIPTION = 'Monthly subscription to keep your business visible on the platform.'
const PLAN_NAME = 'Monthly 300 ILS'
const PLAN_DESCRIPTION = 'Monthly subscription — 300 ILS per month. Cancel anytime in your PayPal account.'

/**
 * POST – Create PayPal catalog product + subscription plan (one-time setup).
 * Requires tenant auth. Returns { productId, planId }.
 * Add planId to .env as NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID and restart.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isPayPalOrdersEnabled()) {
    return NextResponse.json(
      { error: 'PayPal not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.' },
      { status: 503 }
    )
  }
  try {
    const { slug } = await params
    const auth = await checkTenantAuth(slug)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
    }

    const product = await createPayPalCatalogProduct({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      type: 'SERVICE',
      category: 'SOFTWARE',
    })

    const plan = await createPayPalBillingPlan({
      product_id: product.id,
      name: PLAN_NAME,
      description: PLAN_DESCRIPTION,
      amount: String(SUBSCRIPTION_MONTHLY_PRICE_ILS),
      currency_code: 'ILS',
      interval_unit: 'MONTH',
      interval_count: 1,
      total_cycles: 0,
    })

    return NextResponse.json({
      productId: product.id,
      planId: plan.id,
      message: `Add to .env: NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=${plan.id}`,
    })
  } catch (e) {
    console.error('[Subscription setup-plan]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create product or plan' },
      { status: 500 }
    )
  }
}
