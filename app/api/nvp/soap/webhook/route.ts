import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getTenantByPayPalSubscriptionId } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { addMonthsToDate } from '@/lib/subscription'

/**
 * BEDI NVP SOAP Webhook – receives all events at POST /api/nvp/soap/webhook.
 *
 * Configured in dashboard: https://bedi.delivery/api/nvp/soap/webhook
 * Webhook ID: 8MK21763MD0340910 | Events: All Events
 *
 * Env (server-only; do not use NEXT_PUBLIC_ for secrets):
 *   BEDI_NVP_SOAP_WEBHOOK_SECRET  – verify X-Bedi-Signature (HMAC-SHA256 of body).
 *   BEDI_NVP_SOAP_CLIENT_ID       – optional; for logging.
 *   PAYPAL_WEBHOOK_ID             – optional; Webhook ID (8MK21763MD0340910) for PayPal verification.
 *
 * When event_type is PAYMENT.SALE.COMPLETED, finds tenant by resource.billing_agreement_id
 * (= paypalSubscriptionId) and extends subscription by 1 month.
 */

const WEBHOOK_SECRET = process.env.BEDI_NVP_SOAP_WEBHOOK_SECRET?.trim() || ''
const CLIENT_ID = process.env.BEDI_NVP_SOAP_CLIENT_ID?.trim() || ''
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID?.trim() || ''

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function parsePayload(raw: string, contentType: string): Record<string, unknown> | null {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() || ''
  if (type === 'application/json') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (type === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(raw)
    const obj: Record<string, unknown> = {}
    params.forEach((v, k) => {
      obj[k] = v
    })
    return obj
  }
  return null
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!WEBHOOK_SECRET) return true
  if (!signatureHeader?.startsWith('sha256=')) return false
  const received = signatureHeader.slice(7).toLowerCase()
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  if (received.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

/** Extend tenant subscription by 1 month when PayPal subscription payment is received. */
async function handlePayPalSubscriptionPayment(subscriptionId: string): Promise<boolean> {
  const tenant = await getTenantByPayPalSubscriptionId(subscriptionId)
  if (!tenant) return false
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
      subscriptionLastPaymentAt: nowIso,
    })
    .commit()
  console.info('[webhook] Extended subscription for tenant', tenant._id, 'until', newExpiresAt.toISOString())
  return true
}

/** GET – allow callers to confirm the webhook URL is reachable (e.g. health check). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: 'BEDI NVP SOAP',
    url: 'https://bedi.delivery/api/nvp/soap/webhook',
    ...(PAYPAL_WEBHOOK_ID ? { paypalWebhookId: PAYPAL_WEBHOOK_ID } : {}),
    message: 'Send POST with your webhook payload. PayPal events (e.g. PAYMENT.SALE.COMPLETED) extend tenant subscription when paypalSubscriptionId matches.',
  })
}

/** POST – receive webhook events. Returns 200 on success so the sender does not retry. */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-bedi-signature') ?? req.headers.get('X-Bedi-Signature')
    const contentType = req.headers.get('content-type') ?? ''
    const payload = parsePayload(rawBody, contentType) ?? { _raw: rawBody.slice(0, 500) }

    const eventType: string =
      typeof payload.event_type === 'string'
        ? payload.event_type
        : typeof (payload as Record<string, unknown>).eventType === 'string'
          ? String((payload as Record<string, unknown>).eventType)
          : 'unknown'

    const looksLikePayPal =
      /^(PAYMENT\.|BILLING\.|CHECKOUT\.|CUSTOMER\.)/.test(eventType) ||
      !!req.headers.get('paypal-transmission-id')
    if (!looksLikePayPal && !verifySignature(rawBody, signature)) {
      console.warn('[webhook] Invalid or missing X-Bedi-Signature (and not a PayPal event)')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (CLIENT_ID) {
      console.info('[webhook]', { eventType, clientId: CLIENT_ID, keys: Object.keys(payload) })
    } else {
      console.info('[webhook]', { eventType, keys: Object.keys(payload) })
    }

    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const resource = payload.resource as Record<string, unknown> | undefined
      const subscriptionId =
        (typeof resource?.billing_agreement_id === 'string' && resource.billing_agreement_id) ||
        (typeof resource?.id === 'string' && resource.id) ||
        ''
      if (subscriptionId) {
        const extended = await handlePayPalSubscriptionPayment(subscriptionId)
        return NextResponse.json({ received: true, eventType, subscriptionExtended: extended })
      }
    }

    return NextResponse.json({
      received: true,
      eventType,
      ...(PAYPAL_WEBHOOK_ID ? { webhookId: PAYPAL_WEBHOOK_ID } : {}),
    })
  } catch (e) {
    console.error('[webhook]', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
