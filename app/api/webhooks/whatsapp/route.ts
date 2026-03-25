import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendAdminNotification } from '@/lib/admin-push'
import { canonicalWhatsAppInboxPhone } from '@/lib/whatsapp-inbox-phone'
import {
  WHATSAPP_OUTBOUND_STATUS_COLLECTION,
  wamidToFirestoreDocId,
} from '@/lib/whatsapp-outbound-status'

/**
 * Meta WhatsApp Cloud API Webhook
 * - GET: Verification (hub.verify_token, hub.challenge)
 * - POST: Incoming messages and status updates
 *
 * Configure in Meta Developer Console:
 * - Callback URL: https://yourdomain.com/api/webhooks/whatsapp
 * - Verify token: Set WHATSAPP_VERIFY_TOKEN in .env
 * - Subscribe to: messages (includes inbound messages + outbound status: sent/delivered/failed)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ success: false }, { status: 200 })
    }

    const entries = body.entry ?? []
    for (const entry of entries) {
      const changes = entry.changes ?? []
      for (const change of changes) {
        if (change.field !== 'messages') continue
        const value = change.value ?? {}
        const phoneNumberId = value.metadata?.phone_number_id
        const displayPhoneNumber = value.metadata?.display_phone_number

        /** Outbound template/status updates — Meta reports delivery failures here (user "sees nothing"). */
        const statuses = (value.statuses ?? []) as Array<{
          id?: string
          status?: string
          recipient_id?: string
          errors?: Array<{ code?: number; title?: string; message?: string; error_data?: unknown }>
        }>
        for (const st of statuses) {
          const id = st.id ?? ''
          const status = st.status ?? ''
          const errs = st.errors ?? []

          // Persist every pipeline status (sent / delivered / read / failed) for admin Delivery log.
          if (id) {
            try {
              const { getFirestoreAdmin, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin')
              if (isFirebaseAdminConfigured()) {
                const db = getFirestoreAdmin()
                if (db) {
                  const docId = wamidToFirestoreDocId(id)
                  await db.collection(WHATSAPP_OUTBOUND_STATUS_COLLECTION).doc(docId).set(
                    {
                      wamid: id,
                      status,
                      recipientId: st.recipient_id ?? '',
                      errors: errs,
                      businessDisplayPhone: displayPhoneNumber ?? '',
                      phoneNumberId: phoneNumberId ?? '',
                      updatedAtMs: Date.now(),
                    },
                    { merge: true }
                  )
                }
              }
            } catch (e) {
              console.error('[WhatsApp Webhook] Failed to persist outbound status', e)
            }
          }

          if (status === 'failed' || errs.length > 0) {
            console.error(
              '[WhatsApp Webhook] OUTBOUND FAILED',
              JSON.stringify({
                wamid: id,
                status,
                recipient_id: st.recipient_id,
                errors: errs,
              })
            )
            try {
              const { getFirestoreAdmin, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin')
              if (isFirebaseAdminConfigured()) {
                const db = getFirestoreAdmin()
                if (db) {
                  await db.collection('broadcastDeliveryErrors').add({
                    wamid: id,
                    recipientPhone: st.recipient_id,
                    businessPhone: displayPhoneNumber,
                    errors: errs,
                    createdAtMs: Date.now(),
                    createdAtIso: new Date().toISOString(),
                  })
                }
              }
            } catch (e) {
              console.error('[WhatsApp Webhook] Failed to log delivery error to Firestore', e)
            }
          } else if (id || status) {
            console.log(
              '[WhatsApp Webhook] outbound',
              status || '?',
              'to',
              st.recipient_id ?? '?',
              id ? `wamid=${id.slice(0, 24)}…` : ''
            )
          }
        }

        const messages = value.messages ?? []

        for (const msg of messages) {
          const from = String(msg.from ?? '')
          const msgId = msg.id
          const timestamp = msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now()
          let text = ''
          let messageType: string = 'text'

          if (msg.type === 'text' && msg.text?.body) {
            text = msg.text.body
            messageType = 'text'
          } else if (msg.type === 'button' && msg.button?.text) {
            text = msg.button.text
            messageType = 'text'
          } else if (msg.type === 'interactive' && msg.interactive?.button_reply?.title) {
            text = msg.interactive.button_reply.title
            messageType = 'text'
          } else if (['image', 'audio', 'video', 'document'].includes(msg.type)) {
            text = `[${msg.type}]`
            messageType = msg.type
          } else {
            text = '[Unsupported message]'
            messageType = 'unsupported'
          }

          if (!from || !text) continue

          const canonicalFrom = canonicalWhatsAppInboxPhone(from)

          const writeClient = client.withConfig({ token: token ?? undefined, useCdn: false })
          const existing = await writeClient.fetch<{ _id: string } | null>(
            `*[_type == "whatsappMessage" && waMessageId == $msgId][0]{ _id }`,
            { msgId }
          )
          if (existing) continue

          await writeClient.create({
            _type: 'whatsappMessage',
            participantPhone: canonicalFrom,
            businessPhone: displayPhoneNumber ? canonicalWhatsAppInboxPhone(displayPhoneNumber) : undefined,
            businessPhoneNumberId: phoneNumberId,
            direction: 'in',
            text,
            waMessageId: msgId,
            messageType,
            createdAt: new Date(timestamp).toISOString(),
          })

          await sendAdminNotification(
            'New WhatsApp message',
            `+${canonicalFrom}: ${text.substring(0, 80)}${text.length > 80 ? '…' : ''}`,
            '/admin/broadcast?tab=inbox'
          )
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook]', err)
  }
  return NextResponse.json({ success: true }, { status: 200 })
}
