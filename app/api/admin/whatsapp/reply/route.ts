import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendWhatsAppTextMessage } from '@/lib/meta-whatsapp'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

import { canonicalWhatsAppInboxPhone } from '@/lib/whatsapp-inbox-phone'

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { to, text } = body

  if (!to || typeof to !== 'string' || to.trim() === '') {
    return NextResponse.json({ error: 'Missing "to" (phone number)' }, { status: 400 })
  }
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json({ error: 'Missing "text" (message body)' }, { status: 400 })
  }

  const result = await sendWhatsAppTextMessage(to.trim(), text.trim())

  if (!result.success) {
    const errMsg = typeof result.error === 'object' && result.error && 'error' in result.error
      ? String((result.error as { error?: { message?: string } }).error?.message ?? JSON.stringify(result.error))
      : String(result.error)
    return NextResponse.json(
      { error: errMsg || 'Failed to send WhatsApp message' },
      { status: 400 }
    )
  }

  const writeClient = client.withConfig({ token: token ?? undefined, useCdn: false })
  await writeClient.create({
    _type: 'whatsappMessage',
    participantPhone: canonicalWhatsAppInboxPhone(to),
    direction: 'out',
    text: text.trim(),
    waMessageId: (result as { messageId?: string }).messageId ?? '',
    messageType: 'text',
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
