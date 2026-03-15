import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

/**
 * Meta WhatsApp Cloud API Webhook
 * - GET: Verification (hub.verify_token, hub.challenge)
 * - POST: Incoming messages and status updates
 *
 * Configure in Meta Developer Console:
 * - Callback URL: https://yourdomain.com/api/webhooks/whatsapp
 * - Verify token: Set WHATSAPP_VERIFY_TOKEN in .env
 * - Subscribe to: messages
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
        const messages = value.messages ?? []
        const phoneNumberId = value.metadata?.phone_number_id
        const phoneNumberIdEnv = process.env.WHATSAPP_PHONE_NUMBER_ID
        if (phoneNumberId !== phoneNumberIdEnv) continue

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

          const writeClient = client.withConfig({ token: token ?? undefined, useCdn: false })
          const existing = await writeClient.fetch<{ _id: string } | null>(
            `*[_type == "whatsappMessage" && waMessageId == $msgId][0]{ _id }`,
            { msgId }
          )
          if (existing) continue

          await writeClient.create({
            _type: 'whatsappMessage',
            participantPhone: from,
            direction: 'in',
            text,
            waMessageId: msgId,
            messageType,
            createdAt: new Date(timestamp).toISOString(),
          })
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook]', err)
  }
  return NextResponse.json({ success: true }, { status: 200 })
}
