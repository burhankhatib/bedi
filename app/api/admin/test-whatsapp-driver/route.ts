import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendWhatsAppTemplateMessageWithLangFallback } from '@/lib/meta-whatsapp'
import { WHATSAPP_TEMPLATE } from '@/lib/whatsapp-meta-templates'

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { phone } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    const result = await sendWhatsAppTemplateMessageWithLangFallback(
      phone,
      WHATSAPP_TEMPLATE.NEW_DELIVERY,
      []
    )

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to send message', details: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[Admin Test WhatsApp Driver]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
