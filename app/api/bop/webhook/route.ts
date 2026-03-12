import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantBySlug } from '@/lib/tenant'
import {
  isBOPConfigured,
  parseBOPInternalReference,
} from '@/lib/bop-payments'
import { SUBSCRIPTION_PLANS, addMonthsToDate, type PlanId } from '@/lib/subscription'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST /api/bop/webhook
 * Bank of Palestine sends server-to-server notification on payment completion.
 *
 * Expected body (adapt to your BOP product):
 * { amount, reference, instructionId, transactionId, internalReference, ... }
 *
 * internalReference should be "slug:planId" (e.g. "my-store:1m").
 */
export async function POST(req: NextRequest) {
  if (!isBOPConfigured()) {
    return NextResponse.json({ error: 'BOP not configured' }, { status: 503 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const instructionId = (body.instructionId ?? body.instruction_id ?? body.id) as string | undefined
  const internalReference = (body.internalReference ?? body.internal_reference ?? body.reference) as string | undefined

  const parsed = internalReference ? parseBOPInternalReference(String(internalReference)) : null
  if (!parsed) {
    console.warn('[BOP webhook] Missing or invalid internalReference:', internalReference)
    return NextResponse.json({ error: 'Invalid reference' }, { status: 400 })
  }

  const { slug, planId } = parsed
  const tenant = await getTenantBySlug(slug)
  if (!tenant) {
    console.warn('[BOP webhook] Tenant not found:', slug)
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Idempotency
  if (instructionId) {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "bopProcessedPayment" && instructionId == $id][0]{ _id }`,
      { id: String(instructionId) }
    )
    if (existing) {
      return NextResponse.json({ ok: true, already_processed: true })
    }
  }

  const plan = SUBSCRIPTION_PLANS[planId as PlanId]
  if (!plan) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
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
    })
    .commit()

  if (instructionId) {
    await writeClient.create({
      _type: 'bopProcessedPayment',
      instructionId: String(instructionId),
      processedAt: new Date().toISOString(),
      tenantSlug: slug,
      planId,
    })
  }

  return NextResponse.json({
    ok: true,
    subscriptionExpiresAt: newExpiresAt.toISOString(),
    plan: planId,
  })
}
