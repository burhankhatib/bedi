import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantBySlug } from '@/lib/tenant'
import {
  isBOPConfigured,
  parseBOPInternalReference,
} from '@/lib/bop-payments'
import { SUBSCRIPTION_PLANS, addMonthsToDate } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/**
 * GET /api/bop/callback
 * Bank of Palestine redirects the customer here after payment.
 * Query params (varies by BOP product): instructionId, internalReference, status, etc.
 *
 * We parse internalReference (slug:planId) to extend the tenant subscription and redirect to billing.
 */
export async function GET(req: NextRequest) {
  if (!isBOPConfigured()) {
    return NextResponse.redirect(`${APP_BASE}?bop_error=not_configured`)
  }

  const { searchParams } = req.nextUrl
  const instructionId = searchParams.get('instructionId')?.trim()
  const internalReference = searchParams.get('internalReference')?.trim()
  const status = searchParams.get('status')?.toLowerCase()

  // Failed or cancelled - redirect to billing with error
  if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
    const slug = internalReference ? parseBOPInternalReference(internalReference)?.slug : null
    const billingUrl = slug
      ? `${APP_BASE}/t/${slug}/manage/billing?bop_return=failed`
      : `${APP_BASE}?bop_error=payment_failed`
    return NextResponse.redirect(billingUrl)
  }

  const parsed = internalReference ? parseBOPInternalReference(internalReference) : null
  if (!parsed) {
    return NextResponse.redirect(`${APP_BASE}?bop_error=invalid_reference`)
  }

  const { slug, planId } = parsed
  const tenant = await getTenantBySlug(slug)
  if (!tenant) {
    return NextResponse.redirect(`${APP_BASE}?bop_error=tenant_not_found`)
  }

  // Idempotency: avoid extending twice if callback and webhook both fire
  if (instructionId) {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "bopProcessedPayment" && instructionId == $id][0]{ _id }`,
      { id: instructionId }
    )
    if (existing) {
      return NextResponse.redirect(
        `${APP_BASE}/t/${slug}/manage/billing?bop_return=1&already_processed=1`
      )
    }
  }

  const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]
  if (!plan) {
    return NextResponse.redirect(`${APP_BASE}/t/${slug}/manage/billing?bop_error=invalid_plan`)
  }

  const from =
    tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) > new Date()
      ? new Date(tenant.subscriptionExpiresAt)
      : new Date()
  const months = plan.months
  const newExpiresAt = addMonthsToDate(from, months)

  await writeClient
    .patch(tenant._id)
    .set({
      subscriptionExpiresAt: newExpiresAt.toISOString(),
      subscriptionStatus: 'active',
      subscriptionPlan: plan.tier,
      subscriptionLastPaymentAt: new Date().toISOString(),
    })
    .commit()

  if (instructionId) {
    await writeClient.create({
      _type: 'bopProcessedPayment',
      instructionId,
      processedAt: new Date().toISOString(),
      tenantSlug: slug,
      planId,
    })
  }

  return NextResponse.redirect(
    `${APP_BASE}/t/${slug}/manage/billing?bop_return=1&success=1`
  )
}
