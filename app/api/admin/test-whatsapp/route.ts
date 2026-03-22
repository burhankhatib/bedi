import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendWhatsAppTemplateMessageWithLangFallback } from '@/lib/meta-whatsapp'
import { TENANT_NEW_ORDER_TEMPLATE } from '@/lib/send-tenant-new-order-whatsapp'

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { phone, tenantName } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    const result = await sendWhatsAppTemplateMessageWithLangFallback(
      phone,
      TENANT_NEW_ORDER_TEMPLATE,
      [
        tenantName || 'Business',
        '📦 الطلبات: 1× اختبار (10 ILS) ⸻ 💰 الإجمالي: 10 ILS ⸻ 👤 عميل ⸻ 📞 — ⸻ استلام 🏃',
      ]
    )

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to send message', details: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[Admin Test WhatsApp]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
