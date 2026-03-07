import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'

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

    let result = await sendWhatsAppTemplateMessage(
      phone,
      'new_deliver',
      [],
      'ar_EG'
    )

    // Fallback if ar_EG fails due to template language mismatch
    if (!result.success && result.error?.includes('does not exist in ar_EG')) {
      result = await sendWhatsAppTemplateMessage(
        phone,
        'new_deliver',
        [],
        'ar'
      )
    }

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
