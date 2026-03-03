import { NextResponse } from 'next/server'
import { verifyPreludeWebhookSignature } from '@/lib/prelude-webhook'

/**
 * POST /api/webhooks/prelude
 *
 * Receives Prelude Verify (and Notify) webhook events. Prelude sends:
 * - verify.authentication — verification created and billed
 * - verify.attempt — verification attempt sent to user
 * - verify.delivery_status — delivery status from carrier
 *
 * Configure this URL in Prelude Dashboard (Verify API → Configure → Webhooks)
 * and optionally pass callback_url when creating a verification in request/route.ts.
 *
 * Security: When you enable the SDK signing key in Prelude, set PRELUDE_WEBHOOK_PUBLIC_KEY
 * in .env to the full PEM (see docs/PRELUDE_VERIFY_SETUP.md). The handler verifies
 * X-Webhook-Signature (rsassa-pss-sha256=...) before processing.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signatureHeader = req.headers.get('X-Webhook-Signature')
    const publicKeyPem = process.env.PRELUDE_WEBHOOK_PUBLIC_KEY

    if (signatureHeader) {
      if (!publicKeyPem || !publicKeyPem.trim()) {
        console.error('[Prelude webhook] X-Webhook-Signature present but PRELUDE_WEBHOOK_PUBLIC_KEY is not set')
        return NextResponse.json(
          { error: 'Webhook signing key not configured' },
          { status: 500 }
        )
      }
      const isValid = verifyPreludeWebhookSignature(
        rawBody,
        signatureHeader,
        publicKeyPem.trim()
      )
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody) as {
      id?: string
      type?: string
      payload?: unknown
      created_at?: string
    }

    const eventType = payload?.type
    if (eventType) {
      // Log for debugging; add business logic here if needed (e.g. update delivery status in DB)
      console.info('[Prelude webhook]', {
        id: payload.id,
        type: eventType,
        created_at: payload.created_at,
      })
    }

    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('[Prelude webhook]', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
